---
layout: post
title: "KV Cache trong production: tính đúng VRAM trước khi bạn OOM"
date: 2026-05-07
description: Chắt lọc từ thực tế build & ship LLM inference — vì sao KV Cache tồn tại, cách tính chính xác VRAM, những cần gạt đáng kéo trước, và các sai lầm khiến bạn OOM. Kèm số liệu Llama, DeepSeek, Kimi 2026.
tags: [AI, LLM, KV-cache, inference, VRAM, optimization]
categories: AI
giscus_comments: true
related_posts: true
toc:
  sidebar: left
---

Có một kiểu lỗi rất kinh điển khi đưa LLM lên production: bạn size GPU theo dung lượng **model weights**, deploy ngon lành trên máy test, rồi hệ thống **OOM ngay khi vài user thật cùng vào**. Thủ phạm gần như luôn là **KV cache** — phần bộ nhớ hiếm ai tính tới lúc lên kế hoạch, nhưng ở context dài và nhiều user thì nó còn lớn hơn cả weights.

Bài này là bản mình **gom nhặt và chắt lọc** lại sau khi build & ship vài hệ thống inference — kết hợp tài liệu của Hugging Face, NVIDIA cùng số liệu model 2026, rồi sắp xếp thành một khung tư duy dùng được thật. Mục tiêu rất cụ thể: đọc xong, bạn **tính được chính xác VRAM** cho bất kỳ cấu hình nào, biết **cần gạt nào đáng kéo trước**, và không còn bị bất ngờ lúc 2 giờ sáng.

> ##### Đọc nhanh — 5 điều đọng lại
>
> 1. **KV Cache tăng tuyến tính** theo `context × users`. Ở quy mô thật, nó lớn hơn cả weights.
> 2. **GQA/MLA** cắt cache 8× (hoặc hơn) so với MHA cổ điển mà gần như không mất chất lượng — mọi model 2025–2026 đều dùng.
> 3. **Quantize KV cache xuống FP8** là tối ưu ROI cao nhất: −50% cache, ~99% chất lượng, thêm đúng một flag.
> 4. **PagedAttention (vLLM)** dẹp lãng phí do cấp phát tĩnh, throughput tăng 2–4×.
> 5. Luôn tính **VRAM = Weights + KV Cache + Overhead**. Chỉ tính weights = deploy xong OOM.
{: .block-tip}

*Nguồn tổng hợp chính: [KV Caching Explained (Hugging Face)](https://huggingface.co/blog/not-lain/kv-caching), [Mastering LLM Techniques (NVIDIA)](https://developer.nvidia.com/blog/mastering-llm-techniques-inference-optimization/), cùng config các model 2026. Danh sách đầy đủ ở [cuối bài](#nguồn-tham-khảo).*

---

## Phần I — Vì sao KV Cache tồn tại

Trước khi tối ưu bất cứ thứ gì, cần thấy rõ vấn đề nó giải quyết. Phần này cố tình ngắn — chỉ đủ để xây trực giác.

### LLM sinh text từng token một

Khi bạn hỏi ChatGPT hay bất kỳ LLM nào, câu trả lời không xuất hiện cùng lúc. Model sinh **từng token một** (autoregressive), và mỗi token mới phụ thuộc vào **tất cả** token trước đó.

```bash

Input:  "Hà Nội là"
Step 1: sinh "thủ"     ← nhìn lại "Hà Nội là"
Step 2: sinh "đô"      ← nhìn lại "Hà Nội là thủ"
Step 3: sinh "của"     ← nhìn lại "Hà Nội là thủ đô"
Step 4: sinh "Việt"    ← nhìn lại "Hà Nội là thủ đô của"
Step 5: sinh "Nam"     ← nhìn lại "Hà Nội là thủ đô của Việt"

```

### Không cache: mỗi bước tính lại từ đầu

Trong cơ chế attention, mỗi token cần 3 ma trận: **Query (Q)**, **Key (K)**, **Value (V)**. Model dùng $$(Q. K^T)$$ để tính attention scores, rồi nhân với V ra output.

Nếu **không có cache**, mỗi lần sinh token mới, model phải **tính lại Q, K, V cho toàn bộ chuỗi** từ đầu:

```bash

Step 1: Tính Q,K,V cho ["Hà","Nội","là"]            → 3 token
Step 2: Tính Q,K,V cho ["Hà","Nội","là","thủ"]      → 4 token (3 bị tính lại)
Step 3: Tính Q,K,V cho ["Hà","Nội","là","thủ","đô"] → 5 token (4 bị tính lại)
...
Step N: Tính Q,K,V cho toàn bộ N token              → N-1 bị tính lại

```

Càng về sau càng lãng phí: chi phí tăng theo bình phương độ dài chuỗi, phần lớn là tính lại thứ vừa tính xong.

### Có cache: chỉ tính token mới

Chìa khóa nằm ở một nhận xét: K và V của token cũ **không đổi** giữa các bước (masked attention chỉ nhìn lại, không nhìn tới). Vậy tại sao phải tính lại?

**KV Cache** lưu K, V đã tính vào VRAM. Mỗi bước chỉ cần:

1. Tính Q, K, V cho **1 token mới**
2. Nối K, V mới vào cache
3. Dùng Q mới + toàn bộ K, V trong cache → attention → output

```bash

Step 1: Tính K,V cho ["Hà","Nội","là"] → Cache: [K₁K₂K₃], [V₁V₂V₃]
Step 2: Tính K₄,V₄ cho ["thủ"]         → Cache: [K₁K₂K₃K₄], [V₁V₂V₃V₄]
Step 3: Tính K₅,V₅ cho ["đô"]          → Cache: [K₁K₂K₃K₄K₅], [V₁V₂V₃V₄V₅]

```

Ta đổi **tính lại** lấy **lưu trữ**. Và đó chính xác là gốc rễ của mọi bài toán VRAM phía sau: ta vừa tạo ra một khối bộ nhớ phình to theo từng token.

### Con số biết nói

Trên GPU T4, model SmolLM2-1.7B, sinh 300 token:

| | Thời gian | Speedup |
|---|---|---|
| Không cache | 61 giây | Baseline |
| Có KV cache | 11.7 giây | **5.2× nhanh hơn** |

<br>
Model càng lớn, context càng dài thì speedup càng cao (10–50×). KV cache không phải "tối ưu cho vui" — không có nó, LLM serving gần như bất khả thi. Cái giá là bộ nhớ, và đó là phần còn lại của bài.

---

## Phần II — Cái giá phải trả: tính VRAM

Đây là phần "build & ship" cốt lõi: nếu chỉ nhớ một công thức từ bài này, hãy nhớ công thức ở đây.

### KV cache nằm ở đâu, hình dạng ra sao

Mỗi **layer** transformer tạo K và V riêng. Model 80 layer (Llama 3.3 70B) → 80 cặp `[K, V]` cache độc lập:

```bash

Layer 1:  "Cache_K₁" = [k¹₁, k¹₂, ..., k¹ₙ],  "Cache_V₁" = [v¹₁, v¹₂, ..., v¹ₙ]
Layer 2:  "Cache_K₂" = [k²₁, k²₂, ..., k²ₙ],  "Cache_V₂" = [v²₁, v²₂, ..., v²ₙ]
...
Layer 80: "Cache_K₈₀" = [k⁸⁰₁, k⁸⁰₂, ..., k⁸⁰ₙ], "Cache_V₈₀" = [v⁸⁰₁, v⁸⁰₂, ..., v⁸⁰ₙ]

```

Tổng shape: `[num_layers, 2, batch_size, num_kv_heads, seq_len, head_dim]`. Và toàn bộ khối này nằm trên **VRAM của GPU** — **cùng chỗ với weights**. Đây là lý do nó cạnh tranh trực tiếp với weights cho từng GB bộ nhớ.

### Công thức duy nhất bạn cần

```
KV cache cho 1 token (bytes) = 2 × num_layers × num_kv_heads × head_dim × bytes_per_element
```

| Thành phần | Giải thích |
|---|---|
| `2` | Cả Key lẫn Value |
| `num_layers` | Số tầng transformer (config.json: `num_hidden_layers`) |
| `num_kv_heads` | Số KV heads (config.json: `num_key_value_heads`). Với GQA, nhỏ hơn query heads |
| `head_dim` | `hidden_size / num_attention_heads` |
| `bytes_per_element` | BF16 = 2, FP8 = 1, Q4 = 0.5 |

Nhân lên cho cả chuỗi và cả batch:

```
Tổng (bytes) = batch_size × seq_len × 2 × num_layers × num_kv_heads × head_dim × bytes_per_element
```

> ##### Cạm bẫy hay gặp
> Nhiều bảng tính trên mạng dùng dạng rút gọn `... × hidden_size × ...` (coi `num_kv_heads × head_dim = hidden_size`). Điều này **chỉ đúng với MHA**. Mọi model hiện đại dùng GQA nên `num_kv_heads` nhỏ hơn nhiều — dùng dạng rút gọn sẽ **thổi phồng** con số. Luôn dùng công thức đầy đủ.
{: .block-warning}

Tham số các model phổ biến (kiểm tra config.json trên Hugging Face vì một số chưa công bố đầy đủ):

| Model | Layers | KV Heads | Head Dim | Hidden Size | Attention Type |
|---|---|---|---|---|---|
| Llama 3.1 8B | 32 | 8 | 128 | 4096 | GQA |
| Llama 3.3 70B | 80 | 8 | 128 | 8192 | GQA |
| DeepSeek V4 Flash | ~60 | ~8 | 128 | ~7168 | GQA + MLA |
| Kimi K2.6 | 61 | varies | 128 | ~5120 | MoE + MLA |
| GLM-5.1 | ~80 | ~8 | 128 | ~8192 | GQA |
| Qwen 3.5 (A17B) | ~80 | ~8 | 128 | ~5120 | GQA |
| Phi-4 14B | 40 | 10 | 128 | 5120 | GQA |

### Tính thử: từ nhẹ nhàng đến choáng váng

**Llama 3.1 8B** — `1 token = 2 × 32 × 8 × 128 × 2 = 131.072 bytes ≈ 0.000125 GB`

| Context | 1 user | 10 user | 50 user |
|---|---|---|---|
| 4K | 0.5 GB | 5 GB | 25 GB |
| 32K | 4 GB | 40 GB | 200 GB |
| 128K | **16 GB** | **160 GB** | 800 GB |

Weights FP16 chỉ ~16 GB. Ở 128K context 1 user, KV cache đã **bằng weights**. Ở 10 user × 128K, nó bằng **10× weights**. Đây là khoảnh khắc "à há" của cả bài.

**Llama 3.3 70B** — `1 token = 2 × 80 × 8 × 128 × 2 = 327.680 bytes ≈ 0.00031 GB`

| Context | 1 user | 5 user | 10 user | 20 user |
|---|---|---|---|---|
| 4K | 1.3 GB | 6.5 GB | 13 GB | 26 GB |
| 8K | 2.6 GB | 13 GB | 26 GB | 52 GB |
| 32K | 10.2 GB | 51 GB | 102 GB | 204 GB |
| 128K | **40.6 GB** | 203 GB | **406 GB** | 812 GB |

### Tổng VRAM thật sự cho một deployment

Kịch bản thực tế: Llama 3.3 70B INT4, 10 user, context 32K.

| Thành phần | Giá trị |
|---|---|
| Weights (INT4) | 37 GB |
| KV cache (10 user × 32K, BF16) | 102 GB |
| KV cache (10 user × 32K, **FP8**) | **51 GB** |
| Activations + overhead | ~5 GB |
| **Tổng (BF16 cache)** | **144 GB → 2× H100** |
| **Tổng (FP8 cache)** | **93 GB → 2× H100 (còn dư)** |

> ##### Bài học production
> Ở đây, KV cache (102 GB) **gấp gần 3 lần** weights (37 GB). Chỉ riêng việc đổi cache BF16 → FP8 đã tiết kiệm **51 GB** — đủ để là ranh giới giữa cần 2 GPU và cần 3 GPU. Capacity planning mà bỏ qua KV cache là planning sai.
{: .block-tip}

---

## Phần III — Những cần gạt bạn thực sự điều chỉnh

Đã biết cách tính, giờ là phần ra quyết định. Mình xếp theo **ROI trong production** — kéo cần gạt trên trước.

### Cần gạt 1 — Kiến trúc attention (phần lớn đã chọn sẵn cho bạn)

Đây là đòn bẩy lớn nhất, nhưng bạn hiếm khi tự chỉnh: nó nằm trong thiết kế model. Hiểu nó để **chọn đúng model**.

**MHA cổ điển** — mỗi query head có riêng 1 KV head. Model 70B với 64 query heads → 64 KV heads → cache khổng lồ:

```
MHA cache/token = 2 × 80 × 64 × 128 × 2 = 2.621.440 bytes ≈ 0.0025 GB
```

Ở 128K context: `0.0025 × 131.072 = 327 GB` — chỉ cho **1 user**. Bất khả thi.

**GQA** — nhóm nhiều query heads dùng chung ít KV heads. Llama 3.3 70B: 64 query heads → 8 nhóm → 8 KV heads:

```
GQA cache/token = 2 × 80 × 8 × 128 × 2 = 327.680 bytes  (giảm 8× so với MHA)
```

**MQA** — cực đoan: chỉ 1 KV head cho tất cả query heads (giảm 64×), nhưng chất lượng giảm đáng kể nên ít dùng thuần.

**Bức tranh tổng — 70B, context 128K, 1 user:**

| Attention | KV Heads | Cache 128K | So với MHA |
|---|---|---|---|
| **MHA** | 64 | **327 GB** | Baseline |
| **GQA** (Llama 3.3) | 8 | **40.6 GB** | Giảm 8× |
| **MQA** | 1 | **5.1 GB** | Giảm 64× |

GQA giữ ~99% chất lượng MHA mà cache giảm 8× — lý do **mọi model 2025–2026 đều dùng GQA**. Thế hệ mới hơn (DeepSeek V4, Kimi K2.6) dùng **MLA (Multi-Latent Attention)** — nén K, V xuống không gian latent trước khi cache, hiệu quả hơn cả GQA, đổi lại kiến trúc phức tạp hơn.

### Cần gạt 2 — Quantize KV cache (ROI cao nhất)

Đây là cần gạt bạn **thực sự tự kéo**, và nó rẻ nhất: giống quantize weights, ta lưu cache ở precision thấp hơn.

| Cache precision | 70B, 10 user, 32K | Giảm | Chất lượng |
|---|---|---|---|
| BF16 (mặc định) | 102 GB | Baseline | 100% |
| FP8 | **51 GB** | −50% | ~99% |
| Q4_0 | **26 GB** | −75% | ~95% |

Bật trong **llama.cpp**:

```bash
llama-server --model model.gguf \
  --cache-type-k q4_0 \
  --cache-type-v q4_0 \
  --flash-attn \
  --ctx-size 32768
```

Bật trong **vLLM**:

```bash
vllm serve model --kv-cache-dtype fp8
```

Một dòng flag, giảm nửa cache, chất lượng gần như không đổi. Nếu chỉ làm được một tối ưu, hãy làm cái này. (Qwen 3.5 xử lý KV cache quantization đặc biệt tốt nhờ GQA đã tối ưu sẵn.)

### Cần gạt 3 — Serving engine: đừng để bộ nhớ nằm không

Cách cấp phát KV cache "ngây thơ" lãng phí khủng khiếp. Ba đòn của một serving engine tốt (vLLM):

**PagedAttention** — cấp phát tĩnh, liền mạch cho max context gây 3 loại lãng phí: giữ chỗ cả context chưa dùng (*reserved*), cấp thừa vì không biết output dài bao nhiêu (*internal fragmentation*), và khoảng trống giữa các request cỡ khác nhau (*external fragmentation*). PagedAttention mượn ý tưởng **paging** của OS: chia cache thành **blocks** nhỏ (~16 token), cấp phát **non-contiguous**, dùng block table để tra cứu, trả block ngay khi request xong.

> **Kết quả:** GPU utilization từ ~24% lên **~98.5%**, batch size tăng **2–4×** trên cùng phần cứng.
{: .block-tip}

**Continuous batching** — thay vì gom N request rồi chờ *tất cả* xong (request ngắn phải chờ request dài), engine đưa request mới vào **slot trống ngay khi có request xong**. GPU luôn bận, cache được giải phóng và tái dùng tức thì.

**Prefix caching** — nhiều request chung một system prompt (ví dụ 2.000 token) thì chỉ cần tính + lưu KV cache cho phần đó **một lần**, dùng chung:

```
Không prefix caching:  10 user × (2K system + 8K user) = 100K token cache
Có prefix caching:     1 × 2K (shared) + 10 × 8K user  = 82K token cache  (−18%)
```

Với system prompt / RAG context dài (10K+ token), mức tiết kiệm lên tới **40–60%**.

### Cần gạt 4 — Sliding window & token eviction (tùy tình huống)

Khi context rất dài, có thể **không giữ toàn bộ** cache:

- **Sliding Window** (Mistral): chỉ giữ N token gần nhất (ví dụ 4096), token cũ bị loại. Cache cố định bất kể context dài bao nhiêu. Hợp cho **chat** (thông tin gần quan trọng hơn), không hợp cho **xử lý tài liệu** (cần toàn bộ ngữ cảnh).
- **Token eviction / compression**: loại token "ít quan trọng" (attention score thấp). **StreamingLLM** giữ vài "attention sink" đầu chuỗi + N token gần nhất; **H2O** giữ token có score tích lũy cao; **Dynamic Memory Compression** nén nhóm token lại. Cho phép context "hiệu dụng" dài hơn cache vật lý.

---

## Phần IV — Hiểu sâu để vận hành đúng

Ba chủ đề này không phải cần gạt hằng ngày, nhưng hiểu chúng là ranh giới giữa "chạy được" và "vận hành tốt".

### Prefill vs Decode — hai pha, hai bottleneck

Inference có hai pha với đặc tính trái ngược:

| | Prefill (xử lý input) | Decode (sinh output) |
|---|---|---|
| Cách chạy | Toàn bộ input **song song** | **1 token/bước**, tuần tự |
| Phép tính | matrix × matrix | matrix × vector |
| Bottleneck | **Compute-bound** | **Memory-bound** |
| Đo bằng | tokens/s xử lý (TTFT) | tokens/s sinh (TPS) |

Vì sao decode bị chặn ở bộ nhớ? Mỗi bước phải đọc **toàn bộ weights + KV cache** từ VRAM chỉ để tính cho 1 token:

```
Data đọc mỗi decode step = Weights + KV cache
= 37 GB (70B INT4) + 10.2 GB (1 user, 32K, BF16) = 47.2 GB

Trên H100 (3.350 GB/s):  Max ≈ 3.350 / 47.2 ≈ 71 token/s (lý thuyết)
```

H100 có 990 TFLOPS nhưng 1 token decode chỉ cần ~1 GFLOP — compute utilization <0.1%. **100% bottleneck là đọc bộ nhớ.** Hệ quả trực tiếp:

- **Bandwidth quan trọng hơn TFLOPS** cho inference.
- **Quantize weights + KV cache** tăng tốc trực tiếp (ít data phải đọc).
- **Batch > 1** hiệu quả vì weights chỉ đọc 1 lần cho cả batch.

### MoE — khi weights át cả cache

Model MoE (Kimi K2.6, DeepSeek V4, GLM-5.1) có đặc thù: attention layers vẫn dùng KV cache bình thường, nhưng expert layers **không tạo cache** — chỉ attention mới có. Đổi lại, **toàn bộ** expert weights phải nằm trong VRAM (token nào cũng có thể route tới bất kỳ expert nào).

Hệ quả: với MoE, KV cache chiếm **tỷ lệ nhỏ hơn** trong tổng VRAM (vì weights quá lớn), nhưng vẫn là yếu tố scaling quan trọng khi tăng users/context. Ví dụ Kimi K2.6 (1T params, 61 layers):

- Weights INT4: ~500 GB (chiếm đa số)
- KV cache 1 user 128K (BF16): ~20–30 GB · 10 user: ~200–300 GB
- Tổng cho 10 user: ~700–800 GB → 8× H100 hoặc 4–6× H200

### Speculative decoding — hai model, hai cache

Dùng **model nhỏ** (draft) đoán trước N token, **model lớn** (verifier) kiểm tra song song. Mỗi model cần cache riêng:

```
Draft (7B):  cache nhỏ, sinh nhanh
Main (70B):  cache lớn, verify N token cùng lúc
Tổng KV cache = cache_draft + cache_main
```

Speedup ~1.5–2.5× thường xứng đáng, nhưng nhớ **cộng VRAM của cả hai** khi planning.

---

## Phần V — Dùng được ngay

Phần này để bạn bookmark: sai lầm cần tránh, bảng tra nhanh, công cụ, và những gì cần nhớ.

### Bốn sai lầm khiến bạn OOM lúc 2 giờ sáng

> ##### Đây đều là những cú OOM có thật
> Điểm chung: ai đó tính VRAM chỉ bằng weights.
{: .block-danger}

**"Model 8B chỉ cần 4 GB (INT4)."** Đúng cho weights. Nhưng + 4 GB cache (32K) + 1 GB overhead = ~9 GB — không vừa GPU 8GB nếu context dài.

**"H100 80GB chạy được 70B INT4 cho 20 user."** Weights INT4 37 GB + KV cache 20 user × 8K BF16 = 52 GB → **89 GB > 80 GB → OOM**. Fix: FP8 cache → 26 GB → tổng 65 GB → vừa.

**"Context 10M của Llama 4 Scout chạy trên 1× H100."** Weights ~58 GB + KV cache 1 user × 10M BF16 ≈ **3.100 GB** → cần ~40× H100. Thực tế Scout giới hạn ~128K–256K trên 1 GPU.

**"MoE chỉ cần VRAM cho active params."** Sai. Toàn bộ 1T params của Kimi K2.6 phải ở VRAM dù chỉ 32B active/token — expert không thể offload ra CPU rồi nạp theo nhu cầu (latency không chấp nhận được).

### Cheat sheet tra nhanh

KV cache theo model (1 user, BF16):

| Model | Per token | 4K ctx | 32K ctx | 128K ctx |
|---|---|---|---|---|
| Llama 3.1 8B | 0.125 MB | 0.5 GB | 4 GB | **16 GB** |
| Phi-4 14B | 0.098 MB | 0.4 GB | 3.1 GB | 12.5 GB |
| Llama 3.3 70B | 0.31 MB | 1.3 GB | 10.2 GB | **40.6 GB** |
| Llama 4 Scout 109B | ~0.31 MB | 1.3 GB | 10 GB | 40 GB |

Nhân hệ số nhanh:

| Users | ×cache | | Precision | ×cache |
|---|---|---|---|---|
| 1 | ×1 | | BF16 (baseline) | ×1 |
| 5 | ×5 | | FP8 | ×0.5 |
| 10 | ×10 | | Q4 | ×0.25 |
| 20 | ×20 | | | |

```
VRAM ≈ Weights(precision) + KV_cache(ctx × users × cache_precision) + 10–20% overhead
```

### Công cụ tính

Snippet mình hay dùng để ước lượng nhanh:

```python
def kv_cache_gb(
    num_layers: int,
    num_kv_heads: int,
    head_dim: int,
    seq_len: int,
    batch_size: int = 1,
    precision_bytes: float = 2.0  # BF16=2, FP8=1, Q4=0.5
) -> float:
    """Tính KV cache size (GB)."""
    total_bytes = (
        batch_size * seq_len * 2 * num_layers
        * num_kv_heads * head_dim * precision_bytes
    )
    return total_bytes / (1024 ** 3)

# Llama 3.3 70B, 10 user, 32K, BF16
print(f"{kv_cache_gb(80, 8, 128, 32768, 10, 2):.1f} GB")  # → 97.5 GB
# Cùng config, FP8 cache
print(f"{kv_cache_gb(80, 8, 128, 32768, 10, 1):.1f} GB")  # → 48.8 GB
```

Hoặc dùng công cụ online: [LMCache KV Cache Calculator](https://lmcache.ai/kv_cache_calculator.html) · [LocalLLM VRAM Calculator](https://localllm.in/blog/interactive-vram-calculator).

### Năm điều cần nhớ

1. **KV Cache tăng tuyến tính** theo `context × batch`. Ở context dài + nhiều user, nó lớn hơn weights.
2. **GQA giảm cache 8×** so với MHA mà giữ ~99% chất lượng. Model 2025–2026 dùng GQA hoặc MLA.
3. **Quantize KV cache (FP8)** là tối ưu ROI cao nhất: −50% cache, ~99% chất lượng, thêm một flag.
4. **PagedAttention (vLLM)** dẹp lãng phí do cấp phát tĩnh, throughput +2–4×.
5. **VRAM = Weights + KV Cache + Overhead.** Chỉ tính weights = deploy xong OOM khi user thật vào.

Nếu bài này giúp bạn tránh được một cú OOM, hoặc chỉ đơn giản là size GPU tự tin hơn một chút, vậy là đủ. Có gì chưa chuẩn hoặc bạn có số liệu mới hơn, rất mong bạn góp ý ở phần bình luận bên dưới.

---

## Nguồn tham khảo

1. [Not Lain — KV Caching Explained (Hugging Face)](https://huggingface.co/blog/not-lain/kv-caching)
2. [NVIDIA — Mastering LLM Techniques: Inference Optimization](https://developer.nvidia.com/blog/mastering-llm-techniques-inference-optimization/)
3. [Spheron — GPU Memory Requirements for LLMs](https://www.spheron.network/blog/gpu-memory-requirements-llm/)
4. [Lyceum — KV Cache Memory Calculation for LLMs](https://lyceum.technology/magazine/kv-cache-memory-calculation-llm/)
5. [DEV.to — The Math Behind Local LLMs VRAM](https://dev.to/bytecalculators/the-math-behind-local-llms-how-to-calculate-exact-vram-requirements-before-you-crash-your-gpu-12n5)
6. [LMCache — KV Cache Size Calculator](https://lmcache.ai/kv_cache_calculator.html)
7. [LocalLLM — llama.cpp VRAM Requirements](https://localllm.in/blog/llamacpp-vram-requirements-for-local-llms)
8. [InsiderLLM — KV Cache Optimization Guide](https://insiderllm.com/guides/kv-cache-optimization-guide/)
9. [LLM Garage — KV Cache Optimization: Making Large Context Viable](https://llmgarage.ai/kv-cache-optimization/)
10. [vLLM — Efficient Memory Management with PagedAttention (Paper)](https://arxiv.org/abs/2309.06180)
11. [FlashAttention: Fast and Memory-Efficient Exact Attention (Paper)](https://arxiv.org/abs/2205.14135)
12. [GQA: Training Generalized Multi-Query Transformer Models (Paper)](https://arxiv.org/abs/2305.13245)
13. [Hugging Face — Generation Strategies: KV Caching](https://huggingface.co/docs/transformers/main/en/generation_strategies#kv-caching)
14. [João Lages — Transformers KV Caching Explained (Medium)](https://medium.com/@joaolages/kv-caching-explained-276520203249)
15. [Neptune.ai — Transformers Key-Value Caching](https://neptune.ai/blog/transformers-key-value-caching)

---

*Cập nhật: 23/07/2026.*
