---
layout: post
title: "KV Cache in production: the exact VRAM formula, and cutting it 50% with FP8"
date: 2026-05-07
description: >
  The exact formula for KV-cache VRAM, the constraints to nail before you deploy, and the traps that OOM your box in production — with Llama / DeepSeek / Kimi 2026 numbers and vLLM / llama.cpp snippets. English by default; hover or click any paragraph for the Vietnamese.
tags: [LLM, KV-cache, inference]
categories: AI
related_posts: true
toc:
  sidebar: left
_styles: >
  /* ── Bilingual reading aids (English default · Vietnamese on hover/click) ── */
  .bi { cursor: pointer; border-radius: 4px; transition: background .12s ease, box-shadow .12s ease; }
  .bi:hover { background: color-mix(in srgb, var(--global-theme-color) 9%, transparent); box-shadow: -0.5rem 0 0 color-mix(in srgb, var(--global-theme-color) 9%, transparent); }
  .bi.is-vi { background: color-mix(in srgb, var(--global-signal) 11%, transparent); box-shadow: -0.5rem 0 0 color-mix(in srgb, var(--global-signal) 11%, transparent); }
  .bi.is-vi::after { content: "VI"; font-family: var(--font-mono); font-size: .58rem; letter-spacing: .1em; color: var(--global-signal); vertical-align: super; margin-left: .4ch; opacity: .8; }
  /* Bilingual list items are authored as a loose list so each <li> can carry its
     own translation; strip the paragraph margin so the bullets stay tight. */
  .post-content li > p.bi { margin: 0; }

  /* floating peek tooltip */
  #bi-tip { position: fixed; z-index: 1200; max-width: 460px; background: var(--global-surface-color); color: var(--global-text-color); border: 1px solid var(--global-border-color); border-left: 3px solid var(--global-theme-color); border-radius: 7px; padding: .7rem .95rem; font-family: var(--font-body); font-size: .92rem; line-height: 1.62; box-shadow: 0 16px 46px -16px rgba(0,0,0,.7); pointer-events: none; opacity: 0; transform: translateY(4px); transition: opacity .12s ease, transform .12s ease; }
  #bi-tip.on { opacity: 1; transform: none; }
  #bi-tip .bi-tip-lab { display: block; font-family: var(--font-mono); font-size: .58rem; letter-spacing: .14em; text-transform: uppercase; color: var(--global-theme-color); margin-bottom: .35rem; }
  #bi-tip.is-term { border-left-color: var(--global-signal); max-width: 380px; }
  #bi-tip.is-term .bi-tip-lab { color: var(--global-signal); }
  #bi-tip .bi-tip-vi { display: block; margin-top: .5rem; padding-top: .5rem; border-top: 1px solid var(--global-divider-color); color: var(--global-text-color-light); font-size: .88rem; }
  #bi-tip .bi-tip-vi::before { content: "VI  "; font-family: var(--font-mono); font-size: .56rem; letter-spacing: .1em; color: var(--global-signal); vertical-align: 1px; }

  /* technical term → glossary in _notes */
  .term { color: var(--global-signal); border-bottom: 1px dotted var(--global-signal); text-decoration: none; cursor: help; white-space: nowrap; }
  .term:hover { background: color-mix(in srgb, var(--global-signal) 14%, transparent); }

  /* language control bar */
  .bilang-bar { display: flex; flex-wrap: wrap; align-items: center; gap: .75rem 1rem; margin: 0 0 1.8rem; padding: .55rem .8rem; border: 1px solid var(--global-divider-color); border-left: 2px solid var(--global-theme-color); border-radius: 6px; background: var(--global-surface-color); font-family: var(--font-mono); }
  .bilang-hint { font-size: .68rem; letter-spacing: .02em; color: var(--global-text-color-light); }
  .bilang-hint b { color: var(--global-theme-color); font-weight: 700; }
  .bilang-btn { margin-left: auto; font-family: var(--font-mono); font-size: .72rem; letter-spacing: .04em; padding: .3rem .7rem; border: 1px solid var(--global-theme-color); border-radius: 4px; background: transparent; color: var(--global-theme-color); cursor: pointer; transition: background .12s, color .12s; }
  .bilang-btn:hover, .bilang-btn.on { background: var(--global-theme-color); color: var(--global-bg-color); }

  @media (prefers-reduced-motion: reduce) { #bi-tip { transition: none; } }
---

<div class="bilang-bar" role="group" aria-label="Reading language">
  <span class="bilang-hint"><b>EN</b> by default — <b>hover</b> a paragraph to peek the Vietnamese, <b>click</b> to translate it inline. Dotted <a class="term" href="/notes/glossary/" data-en="Dotted terms — hover for the definition, click to open the full glossary." data-vi="Thuật ngữ gạch chấm — rê để xem định nghĩa, bấm để mở trang glossary.">terms</a> link to the glossary.</span>
  <button class="bilang-btn" id="bilangToggle" type="button" aria-pressed="false">Dịch cả bài → VI</button>
</div>

Recently I debugged an LLM serving box that went OOM the moment a few real users hit it at once — even though the solo-user benchmark on the same GPU had run perfectly smooth. The culprit is almost always the {% term kv-cache %} — memory almost nobody accounts for when sizing a GPU, yet at long context and many users it grows larger than the model weights themselves.
{: .bi data-vi="Gần đây mình debug một hệ thống LLM serving OOM ngay khi vài user thật dùng cùng lúc, dù benchmark solo-user trên cùng GPU chạy êm re. Thủ phạm gần như luôn là KV cache — phần bộ nhớ hiếm ai tính đến lúc size GPU, nhưng ở context dài và nhiều user thì nó lớn hơn cả weights model."}

> ##### TL;DR
>
> KV cache scales linearly with `context × concurrent users`, and at production scale it is usually **larger than the weights**. The full formula is `VRAM = Weights + KV Cache + Overhead` — counting only weights is a recipe for OOM. The fastest win: quantize the KV cache to **FP8** (−50% memory, ~99% quality, one flag), and use a serving engine with PagedAttention (vLLM / SGLang) instead of static allocation.
{: .block-tip}

*Long read — use the left table of contents to jump. Sources at the [end](#further-reading--references).*

---

## Context & constraints
{: .bi data-vi="Bối cảnh & ràng buộc"}

This post is for you if you **self-host / serve LLM inference**. If you only call an API, the provider already handles all of this — you can stop here.
{: .bi data-vi="Bài này dành cho bạn nếu đang tự host / serve LLM inference — nếu chỉ gọi API, provider đã lo phần này, không cần đọc tiếp."}

Before the formula, pin down these four constraints — they change the final number by whole multiples:
{: .bi data-vi="Trước khi vào công thức, xác định rõ 4 ràng buộc sau — chúng quyết định con số cuối cùng khác nhau bao nhiêu lần:"}

- **The GPU you have:** count and type (VRAM, bandwidth) — 1× RTX 4090 24GB is nothing like 8× H100 80GB.
  {: .bi data-vi="GPU bạn có: số lượng, loại (VRAM, băng thông) — 1× RTX 4090 24GB khác hẳn 8× H100 80GB."}

- **Expected concurrent users:** one dev testing is not twenty production users. Cache multiplies linearly with this.
  {: .bi data-vi="Concurrent users kỳ vọng: 1 dev test khác 20 user production. Cache nhân tuyến tính theo số này."}

- **Context length to support:** short chat (4K) is not document processing (128K+). This is the single strongest variable.
  {: .bi data-vi="Context length cần hỗ trợ: chat ngắn (4K) khác document processing (128K+). Đây là biến ảnh hưởng mạnh nhất."}

- **Serving engine:** Ollama for prototyping, vLLM / SGLang for production — the wrong engine makes every other optimization pointless.
  {: .bi data-vi="Serving engine đang/sẽ dùng: Ollama cho prototype, vLLM/SGLang cho production — engine sai thì tối ưu đúng cũng vô nghĩa."}

The post assumes you have **already picked a model** (it does not compare which is best) — it focuses on the capacity planning that most deployment plans skip.
{: .bi data-vi="Bài giả định bạn đã chọn được model (không so sánh model nào tốt hơn) — tập trung vào phần capacity planning mà hầu hết kế hoạch deploy bỏ sót."}

## The VRAM formula for the KV cache
{: .bi data-vi="Công thức tính VRAM cho KV cache"}

Every token in the context must store a Key and a Value for **each layer** and **each KV head** — because attention has to look back at every prior token on every generation step, and recomputing from scratch each step would cost quadratically in sequence length. The KV cache trades "recompute" for "storage" — the price is memory that grows linearly with tokens instead of quadratically with time.
{: .bi data-vi="Mỗi token trong context phải lưu Key và Value cho mỗi layer, mỗi KV head — vì attention cần nhìn lại toàn bộ token trước đó ở mọi bước sinh, và nếu tính lại từ đầu mỗi bước thì chi phí tăng theo bình phương độ dài chuỗi. KV cache đổi 'tính lại' lấy 'lưu trữ' — cái giá là bộ nhớ, tăng tuyến tính theo token thay vì bình phương theo thời gian."}

Per-token formula:
{: .bi data-vi="Công thức cho 1 token:"}

$$
\text{KV cache/token (bytes)} = 2 \times n_{\text{layers}} \times n_{\text{kv\_heads}} \times d_{\text{head}} \times \text{bytes}
$$

| Component | Meaning |
|---|---|
| `2` | Both Key and Value |
| `n_layers` | Number of transformer layers (`config.json: num_hidden_layers`) |
| `n_kv_heads` | Number of KV heads (`config.json: num_key_value_heads`) — with GQA, far fewer than query heads |
| `d_head` | `hidden_size / num_attention_heads` |
| `bytes` | BF16 = 2, FP8 = 1, Q4 = 0.5 |

Scale it up over the whole sequence and batch:
{: .bi data-vi="Nhân lên cho cả chuỗi và batch:"}

$$
\text{Total (bytes)} = \text{batch\_size} \times \text{seq\_len} \times 2 \times n_{\text{layers}} \times n_{\text{kv\_heads}} \times d_{\text{head}} \times \text{bytes}
$$

> ##### A common hand-calc trap
> Many calculators online use the shortened form `... × hidden_size × ...` (treating `num_kv_heads × head_dim = hidden_size`) — that only holds for **MHA**. Modern models use GQA, so `num_kv_heads` is much smaller — the shortened form **overstates** the number. Always use the full formula.
{: .block-warning}

**Hand-calc example — Llama 3.1 8B** (32 layers, 8 KV heads, head_dim 128, BF16):
{: .bi data-vi="Ví dụ tính tay — Llama 3.1 8B (32 layers, 8 KV heads, head_dim 128, BF16):"}

```
1 token = 2 × 32 × 8 × 128 × 2 = 131,072 bytes ≈ 0.000125 GB
```

| Context | 1 user | 10 users | 50 users |
|---|---|---|---|
| 4K | 0.5 GB | 5 GB | 25 GB |
| 32K | 4 GB | 40 GB | 200 GB |
| 128K | **16 GB** | **160 GB** | 800 GB |

This model's FP16 weights are only ~16GB — at 128K context, **one user's cache already equals the weights**. At 10 users, cache is 10× the weights. This is the number most often dropped when sizing a GPU.
{: .bi data-vi="Weights FP16 của model này chỉ ~16GB — ở 128K context, 1 user thôi cache đã bằng weights. Ở 10 user, cache gấp 10× weights. Đây là con số hay bị bỏ sót nhất khi size GPU."}

**Llama 3.3 70B** (80 layers, 8 KV heads, head_dim 128, BF16): `1 token = 2×80×8×128×2 = 327,680 bytes ≈ 0.00031 GB`.
{: .bi data-vi="Llama 3.3 70B (80 layers, 8 KV heads, head_dim 128, BF16): 1 token = 2×80×8×128×2 = 327.680 bytes ≈ 0.00031 GB."}

| Context | 1 user | 5 users | 10 users | 20 users |
|---|---|---|---|---|
| 4K | 1.3 GB | 6.5 GB | 13 GB | 26 GB |
| 32K | 10.2 GB | 51 GB | 102 GB | 204 GB |
| 128K | **40.6 GB** | 203 GB | **406 GB** | 812 GB |

**A real deployment:** Llama 3.3 70B INT4, 10 users, 32K context:
{: .bi data-vi="Deployment thật: Llama 3.3 70B INT4, 10 user, context 32K:"}

| Component | Value |
|---|---|
| Weights (INT4) | 37 GB |
| KV cache (10 users × 32K, BF16) | 102 GB |
| KV cache (10 users × 32K, **FP8**) | **51 GB** |
| Activations + overhead | ~5 GB |
| **Total (BF16 cache)** | **144 GB → needs 2× H100** |
| **Total (FP8 cache)** | **93 GB → 2× H100, with room to spare** |

Here the KV cache (102GB) is **nearly 3× the weights** (37GB). Just switching BF16→FP8 saves 51GB — enough to be the line between 2 and 3 GPUs.
{: .bi data-vi="KV cache (102GB) ở đây gấp gần 3 lần weights (37GB). Chỉ riêng đổi BF16→FP8 tiết kiệm 51GB — đủ để là ranh giới giữa 2 và 3 GPU."}

## The attention architecture decides cache size
{: .bi data-vi="Kiến trúc attention quyết định cache to hay nhỏ"}

This is the biggest lever, yet one you rarely tune yourself — it is baked into the model design, not a deploy-time config. Understand it so you **pick the right model** for your VRAM budget.
{: .bi data-vi="Đây là đòn bẩy lớn nhất nhưng bạn hiếm khi tự chỉnh — nó nằm trong thiết kế model, không phải config lúc deploy. Hiểu nó để chọn đúng model cho ràng buộc VRAM của bạn."}

| Attention | KV Heads (70B) | Cache @ 128K, 1 user | vs MHA |
|---|---|---|---|
| **MHA** (classic) | 64 | **327 GB** | Baseline |
| **GQA** (Llama 3.3, most 2025-2026) | 8 | **40.6 GB** | 8× smaller |
| **MQA** (extreme) | 1 | **5.1 GB** | 64× smaller |

{% term gqa %} keeps ~99% of MHA quality while cutting cache 8× — the reason nearly every 2025–2026 model uses it. {% term mqa %} shrinks further but drops quality noticeably, so pure MQA is rare. Newer generations (DeepSeek V4, Kimi K2.6) use {% term mla %} — compressing K, V into a latent space before caching, more efficient than GQA at the cost of a more complex architecture.
{: .bi data-vi="GQA giữ ~99% chất lượng MHA mà cache giảm 8× — lý do gần như mọi model 2025–2026 đều dùng GQA. MQA giảm mạnh hơn nữa nhưng chất lượng giảm đáng kể nên ít ai dùng thuần. Thế hệ mới hơn (DeepSeek V4, Kimi K2.6) dùng MLA — nén K, V xuống không gian latent trước khi cache, hiệu quả hơn GQA, đổi lại kiến trúc phức tạp hơn."}

## Four levers to cut cache, ranked by ROI
{: .bi data-vi="Bốn đòn bẩy giảm cache, xếp theo ROI"}

### 1 — Quantize the KV cache (do this first, cheapest)
{: .bi data-vi="1 — Quantize KV cache (làm trước tiên, rẻ nhất)"}

| Precision | 70B, 10 users, 32K | Cut | Quality |
|---|---|---|---|
| BF16 (default) | 102 GB | Baseline | 100% |
| FP8 | **51 GB** | −50% | ~99% |
| Q4_0 | **26 GB** | −75% | ~95% |

```bash
# llama.cpp
llama-server --model model.gguf \
  --cache-type-k q4_0 --cache-type-v q4_0 \
  --flash-attn --ctx-size 32768
```

```bash
# vLLM
vllm serve model --kv-cache-dtype fp8
```

One flag, half the cache, quality nearly unchanged. If you do a single optimization, do this one.
{: .bi data-vi="Một dòng flag, giảm nửa cache, chất lượng gần như không đổi. Nếu chỉ làm một tối ưu, làm cái này trước."}

### 2 — Serving engine: don't leave memory idle
{: .bi data-vi="2 — Serving engine: đừng để bộ nhớ nằm không"}

Static allocation (reserving the full max context up front) wastes memory for three reasons: it holds unused context, over-provisions because output length is unknown, and leaves gaps between differently-sized requests.
{: .bi data-vi="Cấp phát tĩnh (đặt trước toàn bộ max context) lãng phí vì 3 lý do: giữ chỗ context chưa dùng, cấp thừa vì không biết output dài bao nhiêu, và khoảng trống giữa các request cỡ khác nhau."}

{% term paged-attention %} (vLLM) borrows the OS paging idea — it splits the cache into small blocks (~16 tokens), allocates them non-contiguously, and frees a block the moment a request finishes.
{: .bi data-vi="PagedAttention (vLLM) mượn ý tưởng paging của OS — chia cache thành block nhỏ (~16 token), cấp phát non-contiguous, trả block ngay khi request xong."}

> GPU utilization goes from ~24% to **~98.5%**, batch size grows **2–4×** on the same hardware.
{: .block-tip}

{% term continuous-batching %} slots a new request into a freed spot the instant one finishes, instead of waiting for the whole batch — the GPU stays busy.
{: .bi data-vi="Continuous batching đưa request mới vào slot trống ngay khi có request xong, thay vì chờ cả batch xong mới nhận request mới — GPU luôn bận."}

{% term prefix-caching %}: when many requests share a system prompt, that part is computed and cached **once** and shared:
{: .bi data-vi="Prefix caching: nhiều request chung system prompt thì chỉ tính + lưu cache phần đó một lần, dùng chung:"}

```
No prefix caching:  10 users × (2K system + 8K user) = 100K tokens cached
With prefix caching: 1 × 2K (shared) + 10 × 8K user  = 82K tokens cached  (−18%)
```

With long system prompts / RAG context (10K+ tokens), the savings reach 40–60%.
{: .bi data-vi="Với system prompt/RAG context dài (10K+ token), mức tiết kiệm lên tới 40–60%."}

### 3 — Sliding window & token eviction (situational, don't enable by default)
{: .bi data-vi="3 — Sliding window & token eviction (tùy tình huống, không nên bật mặc định)"}

{% term sliding-window Sliding Window %} (Mistral): keep only the last N tokens, giving a fixed cache regardless of how long the context is. Good for **chat** (recent info matters more), **bad for document processing** (loses context at the start of the document).
{: .bi data-vi="Sliding Window (Mistral): chỉ giữ N token gần nhất, cache cố định bất kể context dài bao nhiêu. Hợp cho chat (thông tin gần quan trọng hơn), không hợp cho document processing (mất context ở đầu tài liệu)."}

{% term token-eviction %}: StreamingLLM (keep an attention sink at the start + the last N tokens), H2O (keep tokens with high cumulative attention score), Dynamic Memory Compression (compress groups of tokens). These give an "effective" context longer than the physical cache — but add operational complexity, only worth it once the two levers above aren't enough.
{: .bi data-vi="Token eviction: StreamingLLM (giữ attention sink đầu chuỗi + N token gần nhất), H2O (giữ token có attention score tích lũy cao), Dynamic Memory Compression (nén nhóm token). Cho context 'hiệu dụng' dài hơn cache vật lý — nhưng thêm độ phức tạp vận hành, chỉ đáng cân nhắc khi 2 đòn bẩy trên chưa đủ."}

### 4 — Know when the KV cache isn't the main bottleneck (MoE, speculative decoding)
{: .bi data-vi="4 — Biết khi nào KV cache không phải bottleneck chính (MoE, speculative decoding)"}

{% term moe %} (Kimi K2.6, DeepSeek V4, GLM-5.1): attention layers still produce cache normally, but expert layers don't — in exchange, **all** expert weights must sit in VRAM, because any token can route to any expert (you can't offload to CPU and load on demand — the latency is unacceptable). With MoE, cache is a smaller share of total VRAM because the weights are already huge, but it still scales with users/context: Kimi K2.6 — INT4 weights ~500GB (the majority) + cache for 10 users @128K (BF16) ~200–300GB → ~700–800GB total, needing 8×H100 or 4–6×H200.
{: .bi data-vi="MoE (Kimi K2.6, DeepSeek V4, GLM-5.1): attention layers vẫn tạo cache bình thường, nhưng expert layers không tạo cache — đổi lại toàn bộ expert weights phải nằm VRAM, vì token nào cũng có thể route tới bất kỳ expert nào (không thể offload ra CPU rồi nạp theo nhu cầu — latency không chấp nhận được). Với MoE, cache chiếm tỷ lệ nhỏ hơn trong tổng VRAM vì weights đã quá lớn, nhưng vẫn scale theo user/context: Kimi K2.6 — weights INT4 ~500GB (chiếm đa số) + cache 10 user @128K (BF16) ~200–300GB → tổng ~700–800GB, cần 8×H100 hoặc 4–6×H200."}

{% term speculative-decoding %}: a small draft model guesses ahead, a large verifier checks in parallel — each model needs its own cache: `Total KV cache = cache_draft + cache_main`. A 1.5–2.5× speedup is usually worth it, but remember to add both models' VRAM when planning — the draft model's cache is easy to forget.
{: .bi data-vi="Speculative decoding: model nhỏ (draft) đoán trước, model lớn (verifier) kiểm tra song song — mỗi model cần cache riêng: Tổng KV cache = cache_draft + cache_main. Speedup 1.5–2.5× thường xứng đáng, nhưng nhớ cộng VRAM của cả hai khi planning — phần cache của draft model dễ bị quên."}

## Why bandwidth matters more than TFLOPS
{: .bi data-vi="Vì sao bandwidth quan trọng hơn TFLOPS"}

Inference has two phases of opposite character: {% term prefill prefill %} (process the input, parallel, compute-bound) and {% term decode decode %} (generate the output, sequential, memory-bound). Every decode step must read **all the weights + the KV cache** from VRAM just to produce one token:
{: .bi data-vi="Inference có 2 pha ngược tính chất: prefill (xử lý input, song song, compute-bound) và decode (sinh output, tuần tự, memory-bound). Mỗi bước decode phải đọc toàn bộ weights + KV cache từ VRAM chỉ để tính 1 token:"}

```
Data read per decode step = Weights + KV cache
= 37 GB (70B INT4) + 10.2 GB (1 user, 32K, BF16) = 47.2 GB

On an H100 (3,350 GB/s): max ≈ 3,350 / 47.2 ≈ 71 tokens/s (theoretical)
```

An H100 has 990 TFLOPS, but one decode token needs only ~1 GFLOP — compute utilization <0.1%. The bottleneck is almost entirely memory reads. Direct consequence: quantizing weights + KV cache speeds things up directly (less data to read); batch > 1 helps because weights are read once for the whole batch.
{: .bi data-vi="H100 có 990 TFLOPS nhưng 1 token decode chỉ cần ~1 GFLOP — compute utilization <0.1%. Bottleneck gần như hoàn toàn là đọc bộ nhớ. Hệ quả trực tiếp: quantize weights + KV cache tăng tốc trực tiếp (ít data phải đọc); batch > 1 hiệu quả vì weights chỉ đọc 1 lần cho cả batch."}

## Traps & lessons
{: .bi data-vi="Cạm bẫy & điều học được"}

**Four mistakes that OOM you at 2 a.m.** — the common thread: someone computed VRAM from weights alone.
{: .bi data-vi="Bốn sai lầm khiến bạn OOM lúc 2 giờ sáng — điểm chung: ai đó tính VRAM chỉ bằng weights."}

> ##### "An 8B model only needs 4GB (INT4)"
> True for weights. But +4GB cache (32K) +1GB overhead = ~9GB — won't fit an 8GB GPU if the context is long.
{: .block-danger}

> ##### "An H100 80GB runs 70B INT4 for 20 users"
> INT4 weights 37GB + KV cache 20 users × 8K BF16 = 52GB → **89GB > 80GB → OOM**. Fix: FP8 cache → 26GB → 65GB total → fits.
{: .block-danger}

> ##### "Llama 4 Scout's 10M context runs on 1× H100"
> Weights ~58GB + KV cache 1 user × 10M BF16 ≈ **3,100 GB** → needs ~40× H100. In practice Scout is capped at ~128K–256K on one GPU.
{: .block-danger}

> ##### "MoE only needs VRAM for the active params"
> Wrong. All 1T of Kimi K2.6's parameters must be in VRAM even though only 32B are active per token.
{: .block-danger}

**What I considered but dropped — with reasons** (to pre-empt the "why not X?" questions):
{: .bi data-vi="Những gì mình cân nhắc nhưng bỏ — kèm lý do (để chặn trước câu hỏi 'sao không làm X'):"}

- **MQA instead of GQA** — cuts cache 64× instead of 8×, but quality dropped noticeably on long-reasoning tasks in internal tests. Dropped, unless VRAM is a hard, unbeatable constraint.
  {: .bi data-vi="MQA thay vì GQA — giảm cache 64× thay vì 8×, nhưng chất lượng giảm đáng kể trên task reasoning dài trong test nội bộ. Bỏ, trừ khi VRAM là ràng buộc cứng không thể vượt qua."}

- **Sliding window on by default** — a fixed cache sounds attractive, but it breaks document QA when the question references the start of the document. Only enable it for pure chat endpoints; turn it off for document processing.
  {: .bi data-vi="Sliding window bật mặc định — cache cố định nghe hấp dẫn, nhưng làm hỏng document QA khi câu hỏi tham chiếu đầu tài liệu. Chỉ bật cho endpoint chat thuần, tắt cho endpoint document processing."}

- **Ollama for production** — quick to install, great for prototyping, but no real PagedAttention / continuous batching, so throughput collapses under concurrent users. Move to vLLM as soon as you're past the demo stage.
  {: .bi data-vi="Ollama cho production — cài nhanh, tốt cho prototype, nhưng không có PagedAttention/continuous batching thật nên throughput không đủ khi nhiều user vào cùng lúc. Chuyển sang vLLM ngay khi qua giai đoạn demo."}

- **CPU offload to "save GPU"** — running 70B on system RAM gives only ~1–3 tokens/sec, enough to test but not to serve. Dropped; better to buy/rent more GPU than to offload.
  {: .bi data-vi="CPU offload để 'tiết kiệm GPU' — chạy 70B trên RAM hệ thống chỉ được ~1–3 token/giây, đủ để test, không đủ production. Bỏ, chấp nhận mua/thuê thêm GPU thay vì offload."}

**Quick cheat sheet** (KV cache by model, 1 user, BF16):
{: .bi data-vi="Cheat sheet tra nhanh (KV cache theo model, 1 user, BF16):"}

| Model | Per token | 4K ctx | 32K ctx | 128K ctx |
|---|---|---|---|---|
| Llama 3.1 8B | 0.125 MB | 0.5 GB | 4 GB | **16 GB** |
| Phi-4 14B | 0.098 MB | 0.4 GB | 3.1 GB | 12.5 GB |
| Llama 3.3 70B | 0.31 MB | 1.3 GB | 10.2 GB | **40.6 GB** |
| Llama 4 Scout 109B | ~0.31 MB | 1.3 GB | 10 GB | 40 GB |

Quick multipliers: users ×1/×5/×10/×20; precision BF16 ×1, FP8 ×0.5, Q4 ×0.25.
{: .bi data-vi="Nhân hệ số nhanh: users ×1/×5/×10/×20 tương ứng; precision BF16 ×1, FP8 ×0.5, Q4 ×0.25."}

```
VRAM ≈ Weights(precision) + KV_cache(ctx × users × cache_precision) + 10–20% overhead
```

A quick calculator (Python):
{: .bi data-vi="Công cụ tính nhanh (Python):"}

```python
def kv_cache_gb(
    num_layers: int,
    num_kv_heads: int,
    head_dim: int,
    seq_len: int,
    batch_size: int = 1,
    precision_bytes: float = 2.0  # BF16=2, FP8=1, Q4=0.5
) -> float:
    """KV cache size in GB."""
    total_bytes = (
        batch_size * seq_len * 2 * num_layers
        * num_kv_heads * head_dim * precision_bytes
    )
    return total_bytes / (1024 ** 3)

# Llama 3.3 70B, 10 users, 32K, BF16 vs FP8
print(f"{kv_cache_gb(80, 8, 128, 32768, 10, 2):.1f} GB")  # → 100.0 GB
print(f"{kv_cache_gb(80, 8, 128, 32768, 10, 1):.1f} GB")  # → 50.0 GB
```

Or use an online tool: [LMCache KV Cache Calculator](https://lmcache.ai/kv_cache_calculator.html) · [LocalLLM VRAM Calculator](https://localllm.in/blog/interactive-vram-calculator).
{: .bi data-vi="Hoặc dùng công cụ online: LMCache KV Cache Calculator · LocalLLM VRAM Calculator."}

## Wrap-up
{: .bi data-vi="Kết"}

The one formula to remember: **VRAM = Weights + KV Cache(context × users × precision) + 10–20% overhead.** Counting only weights is a guaranteed OOM when real users arrive.
{: .bi data-vi="Công thức duy nhất cần nhớ: VRAM = Weights + KV Cache(context × users × precision) + 10–20% overhead. Chỉ tính weights là công thức chắc chắn OOM khi user thật vào."}

If you do one thing after reading this: **quantize the KV cache to FP8**. One flag, half the memory, quality nearly unchanged — the highest ROI of every option here.
{: .bi data-vi="Nếu chỉ làm một việc sau khi đọc bài này: quantize KV cache xuống FP8. Một flag, giảm nửa bộ nhớ, chất lượng gần như không đổi — ROI cao nhất trong mọi lựa chọn ở đây."}

The next step depends on your situation: if you're still weighing self-host vs API, I have a separate piece on the [self-host vs API economics](/synthesis/2026/self-hosted-llm-guide/). If you have newer numbers or a different approach, I'd love your input in the comments.
{: .bi data-vi="Bước tiếp theo tuỳ tình huống: nếu còn đang cân nhắc có nên tự host hay dùng API, mình có bài riêng về bài toán kinh tế self-host vs API. Có số liệu mới hơn hoặc cách làm khác, rất mong bạn góp ý ở phần bình luận."}

## Further reading & references
{: .bi data-vi="Đọc thêm và nguồn tham khảo"}

1. [Not Lain — KV Caching Explained (Hugging Face)](https://huggingface.co/blog/not-lain/kv-caching)
2. [NVIDIA — Mastering LLM Techniques: Inference Optimization](https://developer.nvidia.com/blog/mastering-llm-techniques-inference-optimization/)
3. [Spheron — GPU Memory Requirements for LLMs](https://www.spheron.network/blog/gpu-memory-requirements-llm/)
4. [Lyceum — KV Cache Memory Calculation for LLMs](https://lyceum.technology/magazine/kv-cache-memory-calculation-llm/)
5. [DEV.to — The Math Behind Local LLMs VRAM](https://dev.to/bytecalculators/the-math-behind-local-llms-how-to-calculate-exact-vram-requirements-before-you-crash-your-gpu-12n5)
6. [LMCache — KV Cache Size Calculator](https://lmcache.ai/kv_cache_calculator.html)
7. [LocalLLM — llama.cpp VRAM Requirements](https://localllm.in/blog/llamacpp-vram-requirements-for-local-llms)
8. [InsiderLLM — KV Cache Optimization Guide](https://insiderllm.com/guides/kv-cache-optimization-guide/)
9. [LLM Garage — KV Cache Optimization](https://llmgarage.ai/kv-cache-optimization/)
10. [vLLM — Efficient Memory Management with PagedAttention (Paper)](https://arxiv.org/abs/2309.06180)
11. [FlashAttention (Paper)](https://arxiv.org/abs/2205.14135)
12. [GQA: Training Generalized Multi-Query Transformer Models (Paper)](https://arxiv.org/abs/2305.13245)
13. [Hugging Face — Generation Strategies: KV Caching](https://huggingface.co/docs/transformers/main/en/generation_strategies#kv-caching)
14. [João Lages — Transformers KV Caching Explained (Medium)](https://medium.com/@joaolages/kv-caching-explained-276520203249)
15. [Neptune.ai — Transformers Key-Value Caching](https://neptune.ai/blog/transformers-key-value-caching)

---

*Updated: 2026-07-23. Bilingual mode is an experiment — Vietnamese translations are attached per paragraph; refine them anytime by editing the `data-vi` attributes.*

<script>
  (function () {
    var root = document.querySelector(".post-content");
    if (!root) return;

    // ── floating peek tooltip ──
    var tip = document.createElement("div");
    tip.id = "bi-tip";
    document.body.appendChild(tip);
    var tipRAF = null;

    function showTip(text, label, isTerm, x, y) {
      tip.innerHTML = '<span class="bi-tip-lab">' + label + "</span>" + text;
      tip.classList.toggle("is-term", !!isTerm);
      tip.classList.add("on");
      moveTip(x, y);
    }
    function moveTip(x, y) {
      if (tipRAF) cancelAnimationFrame(tipRAF);
      tipRAF = requestAnimationFrame(function () {
        var w = tip.offsetWidth, h = tip.offsetHeight;
        var left = Math.min(x + 16, window.innerWidth - w - 12);
        var top = y + 18;
        if (top + h > window.innerHeight - 12) top = y - h - 14;
        tip.style.left = Math.max(12, left) + "px";
        tip.style.top = Math.max(12, top) + "px";
      });
    }
    function hideTip() { tip.classList.remove("on"); }

    // ── bilingual paragraphs (.bi) + technical terms (.term) ──
    // Handlers are delegated on the root so they survive a paragraph being
    // swapped to Vietnamese and back.
    var paras = root.querySelectorAll(".bi[data-vi]");
    paras.forEach(function (el) { el.dataset.en = el.innerHTML; });

    var lastKey = null;
    root.addEventListener("mousemove", function (e) {
      var term = e.target.closest ? e.target.closest(".term") : null;
      var para = term ? null : (e.target.closest ? e.target.closest(".bi[data-vi]") : null);
      if (!term && (!para || para.classList.contains("is-vi"))) { lastKey = null; hideTip(); return; }
      var key = term ? "t:" + term.href : "p:" + (para.dataset.vi || "").slice(0, 24);
      if (key !== lastKey) {
        lastKey = key;
        if (term) {
          // a term shows both languages at once: English definition + Vietnamese.
          var body = term.dataset.en || "";
          if (term.dataset.vi) body += '<span class="bi-tip-vi">' + term.dataset.vi + "</span>";
          showTip(body, "Definition · Nghĩa", true, e.clientX, e.clientY);
        } else {
          showTip(para.dataset.vi, "Tiếng Việt · bấm để dịch", false, e.clientX, e.clientY);
        }
      } else {
        moveTip(e.clientX, e.clientY);
      }
    });
    root.addEventListener("mouseleave", function () { lastKey = null; hideTip(); });

    // click a paragraph to translate it inline; links & terms keep working
    root.addEventListener("click", function (e) {
      if (e.target.closest("a, .term")) return;
      var para = e.target.closest(".bi[data-vi]");
      if (!para) return;
      hideTip();
      var toVi = !para.classList.contains("is-vi");
      para.classList.toggle("is-vi", toVi);
      para.innerHTML = toVi ? para.dataset.vi : para.dataset.en;
    });

    // ── whole-page toggle ──
    var btn = document.getElementById("bilangToggle");
    var allVi = false;
    if (btn) {
      btn.addEventListener("click", function () {
        allVi = !allVi;
        hideTip();
        paras.forEach(function (el) {
          el.classList.toggle("is-vi", allVi);
          el.innerHTML = allVi ? el.dataset.vi : el.dataset.en;
        });
        btn.classList.toggle("on", allVi);
        btn.setAttribute("aria-pressed", allVi ? "true" : "false");
        btn.textContent = allVi ? "Back to EN ← English" : "Dịch cả bài → VI";
      });
    }
  })();
</script>
