---
layout: post
title: "Tự host LLM hay dùng API: quyết định bằng con số / Self-Host LLM vs. API: A Numbers-Based Decision"
date: 2026-05-05 22:24:00
description: >
  Vì sao 95% trường hợp nên dùng API, cách tính đúng VRAM và điểm hoà vốn, và stack production nếu bạn quyết tự host. Bài song ngữ Việt/Anh, số liệu 05/2026. — Why 95% of teams should use an API, how to calculate real VRAM and break-even, and the production stack if you do self-host. Bilingual VI/EN, data as of May 2026.
tags: [infrastructure, self-host, production]
categories: AI
related_posts: true
toc:
  sidebar: left
---

*Đọc bằng / Read in: [Tiếng Việt](#tiếng-việt) · [English](#english)*

---

## Tiếng Việt

Tháng 5/2026, khoảng cách benchmark giữa model open-weight tốt nhất (Kimi K2.6, SWE-bench 80.2%) và model đóng tốt nhất (Claude Opus 4.6, 80.8%) chỉ còn **0.6%**, trong khi giá API open-weight rẻ hơn 5–70 lần. Câu hỏi "có nên tự host LLM không?" đột nhiên rất thật — và mình nhận ra phần lớn team đang tính sai theo 1 trong 2 hướng: hoặc size GPU thiếu rồi OOM ngay khi user thật vào, hoặc tưởng self-host rẻ rồi cuối tháng trả nhiều hơn cả API.

> ##### TL;DR
>
> **95% trường hợp nên dùng API.** Self-host chỉ đáng khi lưu lượng rất lớn (>50M token/ngày) hoặc bị bắt buộc bởi data residency. VRAM thật = Weights + KV Cache × users + overhead — quên KV cache là deploy xong OOM. Điểm hoà vốn cao (~50–100M token/ngày so với API frontier đắt tiền), và **chi phí ẩn** (GPU idle, setup, bảo trì) mới là thứ giết ROI, không phải giá GPU.
{: .block-tip}

*Nguồn tổng hợp: Onyx AI Leaderboard, model card chính thức, phân tích chi phí thực tế. Danh sách đầy đủ ở [cuối bài](#nguồn-tham-khảo).*

---

### Bối cảnh & ràng buộc

Bài này dành cho bạn nếu team/sản phẩm đang **cân nhắc serve LLM cho production**, đã chọn được model ứng viên, và đang phân vân tự host hay dùng API. Nếu chỉ đang thử nghiệm/prototype, câu trả lời gần như luôn là API — đọc phần Kết để xác nhận.

Trước khi tính toán, xác định rõ 5 ràng buộc sau — chúng quyết định câu trả lời khác nhau bao nhiêu lần:

- **Lưu lượng dự kiến (token/ngày):** biến quan trọng nhất, quyết định điểm hoà vốn. Dưới 10M/ngày gần như luôn nên dùng API.
- **Ngân sách:** capex (mua GPU) hay opex (thuê cloud, trả theo tháng) — self-host cần cam kết vốn hoặc hợp đồng dài hạn.
- **Ràng buộc compliance/data residency:** HIPAA (y tế Mỹ), SOC 2 (tài chính), air-gapped (quốc phòng), hoặc Nghị định 13/2023 của Việt Nam về bảo vệ dữ liệu cá nhân.
- **Năng lực MLOps của team:** ai vận hành, tune, xử lý incident lúc 2 giờ sáng? Không có người này thì self-host là rủi ro vận hành, không phải tiết kiệm.
- **Deadline:** self-host cần tối thiểu 1–4 tuần setup; API ship được trong ngày.

### Bức tranh thị trường 2026 (ngắn gọn)

Open-weight đầu 2026 thay đổi rất nhanh — ít nhất 4 bản nâng cấp lớn chỉ trong Q1–Q2 (Kimi K2.5→K2.6, DeepSeek V3.2→V4, GLM-5→5.1, Qwen 3.5→3.6). Nếu đọc một bài so sánh model không ghi ngày, thông tin có thể đã cũ.

| Model | Active/token | Context | License | SWE-bench |
| :--- | ---: | ---: | :--- | ---: |
| DeepSeek V4 Pro | 49B/1.600B | **1M** | MIT | **80.6%** |
| Kimi K2.6 | 32B/1.000B | 262K | MIT+ | 80.2% |
| GLM-5.1 | 40B/744B | 200K | MIT | — |
| Qwen 3.5 | 17B/397B | — | Apache | — |
| Llama 4 Scout | 17B/109B | **10M** | Llama 4 | — |
| Claude Opus 4.6* | — | — | — | 80.8% |

_\* Model đóng, tham chiếu._

Ba điều rút ra: hầu hết model frontier là **MoE** (không thể so sánh chỉ bằng "số B" tham số); context window đang bùng nổ nhưng KV cache ngốn VRAM tuyến tính theo token nên production thực tế thường giới hạn 128K–256K; **MIT license chiếm ưu thế** — tự do thương mại hoá, fine-tune, redistribute. Benchmark cũng phụ thuộc harness đo (cùng model có thể lệch 10 điểm % tuỳ harness) — luôn test trên workload thật của bạn, không có "model tốt nhất chung chung".

### Công thức VRAM: con số hay bị tính sai

$$
\text{VRAM MIN} = \text{Weights} + \text{KV Cache} + \text{Activations} + \text{Overhead}
$$

Weights là phần ai cũng tính đúng (FP16 = 2 bytes/param, INT4 = 0.5 bytes/param). **KV cache** mới là thủ phạm thầm lặng — mỗi user đồng thời cần cache riêng, và nó tăng tuyến tính theo `context × users`.

Ví dụ Llama 3.3 70B (80 layers, 8 KV heads, BF16): ở 4K context, cache ≈ 1.3GB/user — nhỏ. Ở 128K context, cache ≈ **42.9GB/user** — hơn nửa một H100 80GB, chỉ cho 1 user. Với 10 user ở 32K context, cache đã ~102GB — **gấp gần 3 lần weights INT4 (37GB)**.

Kịch bản có thật: deploy Llama 3.3 70B INT4 (~37GB weights) trên 1× H100 80GB, nghĩ còn dư ~43GB cho cache. Với 4 user @ 32K, cache đã ngốn ~43GB — vừa khít. Thêm 1 user là **OOM crash**.

> ##### Đào sâu công thức
> Mình có bài riêng đi sâu vào công thức KV cache, ví dụ tính tay theo từng model, và cách giảm 50% bằng FP8 quantization: [KV Cache trong production](/synthesis/2026/kv-cache-deep-dive/). Bài này chỉ tóm tắt phần cần cho quyết định self-host vs API.
{: .block-tip}

Hai cạm bẫy VRAM khác cần nhớ: **MoE = toàn bộ tham số phải nằm VRAM** (Kimi K2.6 chỉ kích hoạt 32B/token nhưng cả 1T tham số phải sẵn trên GPU, vì token nào cũng có thể route đến bất kỳ expert nào); và **băng thông quan trọng hơn dung lượng** — tốc độ sinh token phụ thuộc memory bandwidth (H100 ~90 token/s cho 70B INT4, DDR4 CPU offload chỉ ~1.3 token/s — đủ để test, không đủ production).

### Kinh tế: khi nào tự host mới rẻ hơn

Ở mức 1M token/ngày, một case study ghi nhận self-host trên cloud GPU đắt hơn API tới **733 lần** — vì GPU cloud tính tiền theo giờ bất kể bạn dùng bao nhiêu. 4× H100 cloud ~$16–32/giờ ≈ **$11.520/tháng cố định**, dù xử lý 100K hay 10M token/ngày.

| Token/ngày | Claude Sonnet ($3/$15 mỗi triệu) | Self-host 4×H100 | Kết luận |
| ---: | ---: | ---: | :--- |
| 100K | ~$14/tháng | ~$11.520/tháng | API rẻ hơn ~800× |
| 1M | ~$135/tháng | ~$11.520/tháng | API rẻ hơn ~85× |
| 50M | ~$6.750/tháng | ~$11.520/tháng | Hoà vốn |
| 100M | ~$13.500/tháng | ~$11.520/tháng | Self-host thắng |
| 500M | ~$67.500/tháng | ~$11.520/tháng | Self-host thắng rõ |

Break-even đổi tuỳ so với ai: vs Claude Opus ~2–5M token/ngày; vs Claude Sonnet ~10–20M; vs API giá rẻ (DS V4 Flash $0.14/$0.28 mỗi triệu) ~500M+ — gần như bất khả thi trên 1 cluster. Những gì tốn ~$500/tháng năm ngoái, năm nay tốn ~$50 — "cost collapse" của API đang bào mòn dần lý do self-host.

### Quyết định: 5 tình huống nên tự host (95% còn lại — dùng API)

Kết luận từ phân tích 500+ AI deployment thực tế: **95% trường hợp nên dùng API.** Chỉ self-host nếu rơi vào 1 trong 5 tình huống:

1. **Lưu lượng cực lớn, ổn định (>50M token/ngày)** và giữ được GPU utilization >70%.
2. **Data residency bắt buộc** — HIPAA, SOC 2, air-gapped, hoặc Nghị định 13/2023 với dữ liệu người Việt.
3. **Fine-tuned model trên dữ liệu nội bộ** không thể/không muốn đưa lên API người khác.
4. **Bulk task đều đặn** (phân loại, embedding, extraction) — workload đều, complexity thấp.
5. **Model/version cụ thể không có trên API** — frozen version cho legacy pipeline, hoặc cần kiểm soát inference pipeline hoàn toàn.

**Không thuộc 5 trường hợp trên? Dùng API.** Tiết kiệm hàng tuần engineering và ngủ ngon hơn.

### Nếu tự host: ship cho đúng

Chọn engine theo mục đích: **vLLM** cho production nhiều user (PagedAttention tăng GPU utilization 24%→98.5%); **SGLang** cho MoE lớn/structured output; **llama.cpp**/**Ollama** cho dev/prototype — **đừng dùng Ollama cho production** (thiếu continuous batching thật).

Model chạy được mới là lớp đầu tiên trong 4 lớp cần thiết:

```
┌─────────────────────────────────────────┐
│  L4: GIAO DIỆN — Chat UI, API gateway   │
├─────────────────────────────────────────┤
│  L3: RAG & KNOWLEDGE — Vector DB, Search │
├─────────────────────────────────────────┤
│  L2: BẢO MẬT — SSO, RBAC, ACL, PII mask  │
├─────────────────────────────────────────┤
│  L1: INFERENCE — vLLM/SGLang + GPU + Mon │
└─────────────────────────────────────────┘
```

Lộ trình thực tế: Bước 0 — prototype bằng API free tier ($0, 1 ngày); Bước 1 — production v1 bằng API rẻ (~$5–50/tháng, 1 tuần); Bước 2 — nếu cần data residency, 1× RTX 4090 + model nhỏ + vLLM (~$1.600 + setup, 2 tuần); Bước 3 — khi volume >10M token/ngày, đánh giá cluster 4× H100 (1 tháng). Đa số team production 2026 không chọn "hết self-host" hay "hết API", mà **hybrid**: self-host model rẻ cho bulk task, API frontier cho task khó, qua một router đơn giản.

### Cạm bẫy & điều học được

Đây là phần đáng đọc kỹ nhất — kinh nghiệm thật, không có trong docs chính thức.

Bảng break-even ở trên còn *lạc quan* vì chưa tính các khoản này:

| Hạng mục | Chi phí thực tế |
| :--- | :--- |
| GPU idle | GPU ở 10% load → cost per-token tăng **10×** |
| Setup | 2–4 tuần senior ML engineer |
| Bảo trì | 8–20 giờ/tháng engineering time |
| Điện + cooling | $500–4.000/tháng cho cụm 4–8× H100 |

> ##### Case study đáng nhớ
> Một công ty tự host trên 4× A10G, tốn $5.175/tháng. API tương đương chỉ $1.870/tháng. Họ trả **2.8× nhiều hơn** cho "giải pháp tiết kiệm".
{: .block-danger}

**Những gì mình cân nhắc nhưng bỏ — kèm lý do:**

- **Self-host toàn bộ để độc lập API** — cân nhắc vì lo phụ thuộc vendor, nhưng bỏ: economics chỉ thắng rõ ở >50M token/ngày, phần lớn sản phẩm chưa chạm ngưỡng đó, và rủi ro vận hành (OOM, incident 2 giờ sáng) không đáng đổi lấy sự độc lập chưa cần thiết.
- **Ollama cho production vì dễ setup** — cân nhắc vì team chưa quen vLLM, nhưng bỏ: thiếu PagedAttention/continuous batching thật, throughput không đủ khi nhiều user vào cùng lúc. Dùng Ollama cho demo, chuyển vLLM trước khi có user thật.
- **Bỏ qua data residency vì "chắc không ai kiểm tra"** — cân nhắc vì self-host tốn thời gian, nhưng bỏ: rủi ro pháp lý theo Nghị định 13/2023 (hoặc HIPAA/SOC2 tuỳ ngành) không đáng đánh đổi, đặc biệt khi chi phí tuân thủ về sau luôn cao hơn chi phí làm đúng từ đầu.
- **GPU cloud on-demand thay vì reserved** — cân nhắc để linh hoạt, nhưng bỏ nếu traffic không đều: GPU idle 10% load đã đẩy cost/token tăng 10×, on-demand không tiết kiệm như tưởng nếu không giữ utilization cao liên tục.

### Kết

Ba câu hỏi trước khi quyết: (1) Bạn xử lý bao nhiêu token/ngày — dưới 10M thì API, trên 50M mới cân nhắc self-host; (2) Dữ liệu có phải air-gap không — có thì self-host bắt buộc, không thì API an toàn hơn (ít gánh nặng vận hành); (3) Team có MLOps không — không thì API, có thì tính ROI 12 tháng rồi quyết.

Đừng self-host vì "nghe tưởng rẻ hơn". Hãy self-host vì **con số cho thấy nó rẻ hơn** — sau khi đã tính đủ idle cost, engineering time, và cơ hội bỏ lỡ. Nếu quyết định tự host, xem thêm bài [KV Cache trong production](/synthesis/2026/kv-cache-deep-dive/) để tính đúng VRAM trước khi deploy. Có số liệu mới hơn hay góp ý, rất mong bạn để lại ở phần bình luận.

---

## English

In May 2026, the benchmark gap between the best open-weight model (Kimi K2.6, SWE-bench 80.2%) and the best closed model (Claude Opus 4.6, 80.8%) shrank to **0.6%**, while open-weight API pricing runs 5–70× cheaper. The question "should we self-host our LLM?" suddenly became real — and I've noticed most teams get the math wrong in one of two directions: either they undersize the GPU and hit OOM the moment real users show up, or they assume self-hosting is cheap and end up paying more than the API by month's end.

> ##### TL;DR
>
> **95% of cases should use an API.** Self-hosting only pays off at very high volume (>50M tokens/day) or when data residency is mandatory. Real VRAM = Weights + KV Cache × concurrent users + overhead — forgetting KV cache is a guaranteed OOM after deploy. The break-even point is high (~50–100M tokens/day vs. expensive frontier APIs), and **hidden costs** (idle GPU time, setup, maintenance) are what actually kill ROI — not the GPU price tag.
{: .block-tip}

*Sources compiled from the Onyx AI Leaderboard, official model cards, and real-world cost breakdowns. Full list at the [end of the post](#nguồn-tham-khảo).*

---

### Context & Constraints

This post is for you if your team is **weighing self-hosting vs. an API for a production LLM deployment**, you already have a candidate model, and you're unsure which way to go. If you're still prototyping, the answer is almost always "use an API" — jump to the Conclusion to confirm.

Before doing any math, nail down these 5 constraints — they change the answer by orders of magnitude:

- **Expected volume (tokens/day):** the single most important variable, it determines your break-even point. Under 10M/day, an API almost always wins.
- **Budget shape:** capex (buying GPUs) vs. opex (renting cloud, paying monthly) — self-hosting requires capital commitment or a long-term contract.
- **Compliance/data residency requirements:** HIPAA (US healthcare), SOC 2 (finance), air-gapped (defense), or region-specific personal data protection laws.
- **Your team's MLOps capacity:** who operates, tunes, and handles a 2am incident? Without this person, self-hosting is an operational risk, not a saving.
- **Deadline:** self-hosting needs a minimum of 1–4 weeks setup; an API can ship the same day.

### The 2026 Landscape (Briefly)

Open-weight models moved fast in early 2026 — at least 4 major upgrades in Q1–Q2 alone (Kimi K2.5→K2.6, DeepSeek V3.2→V4, GLM-5→5.1, Qwen 3.5→3.6). If you're reading a model comparison without a date stamp, assume it's stale.

| Model | Active/token | Context | License | SWE-bench |
| :--- | ---: | ---: | :--- | ---: |
| DeepSeek V4 Pro | 49B/1.6T | **1M** | MIT | **80.6%** |
| Kimi K2.6 | 32B/1T | 262K | MIT+ | 80.2% |
| GLM-5.1 | 40B/744B | 200K | MIT | — |
| Qwen 3.5 | 17B/397B | — | Apache | — |
| Llama 4 Scout | 17B/109B | **10M** | Llama 4 | — |
| Claude Opus 4.6* | — | — | — | 80.8% |

_\* Closed model, shown for reference._

Three takeaways: most frontier models are **MoE**, so you can't compare models by parameter count alone; context windows are exploding, but KV cache scales linearly with tokens so production deployments are usually capped around 128K–256K in practice; and **MIT licensing dominates** — free to commercialize, fine-tune, and redistribute. Benchmarks are also harness-dependent (the same model can swing 10 points depending on the harness) — always test on your own workload; there's no universally "best" model.

### The VRAM Formula: The Number Everyone Gets Wrong

$$
\text{VRAM MIN} = \text{Weights} + \text{KV Cache} + \text{Activations} + \text{Overhead}
$$

Weights are the part everyone sizes correctly (FP16 = 2 bytes/param, INT4 = 0.5 bytes/param). **KV cache** is the silent culprit — every concurrent user needs its own cache, and it scales linearly with `context length × users`.

For Llama 3.3 70B (80 layers, 8 KV heads, BF16): at 4K context, cache is only ≈1.3GB/user. At 128K context, it balloons to **≈42.9GB/user** — over half an H100 80GB, for a single user. At 10 users and 32K context, cache alone is ~102GB — **almost 3× the INT4 weights (37GB)**.

A real scenario: deploying Llama 3.3 70B INT4 (~37GB weights) on a single H100 80GB, assuming ~43GB is left over for cache. At 4 concurrent users @ 32K context, cache already eats that ~43GB — a perfect fit with zero headroom. One more user and you get an **OOM crash**.

> ##### Going deeper on the formula
> I have a dedicated post working through the full KV cache formula, hand-calculated examples per model, and how to cut memory 50% with FP8 quantization: [KV Cache in Production](/synthesis/2026/kv-cache-deep-dive/). This post only covers what you need for the self-host-vs-API decision.
{: .block-tip}

Two more VRAM traps worth knowing: **MoE means all parameters must live in VRAM** (Kimi K2.6 only activates 32B/token, but the full 1T parameters must sit on the GPU, since any token could route to any expert); and **bandwidth matters more than capacity** — token generation speed depends on memory bandwidth (H100 gets ~90 tokens/sec on a 70B INT4 model, while DDR4 CPU offload only manages ~1.3 tokens/sec — fine for testing, not for production).

### Economics: When Self-Hosting Actually Pays Off

At 1M tokens/day, one case study found self-hosting on cloud GPUs cost **733× more** than an API — because cloud GPUs bill hourly regardless of utilization. 4× H100 on cloud at ~$16–32/hour comes out to a **fixed ~$11,520/month**, whether you process 100K or 10M tokens a day.

| Tokens/day | Claude Sonnet ($3/$15 per million) | Self-host 4×H100 | Verdict |
| ---: | ---: | ---: | :--- |
| 100K | ~$14/month | ~$11,520/month | API ~800× cheaper |
| 1M | ~$135/month | ~$11,520/month | API ~85× cheaper |
| 50M | ~$6,750/month | ~$11,520/month | Roughly break-even |
| 100M | ~$13,500/month | ~$11,520/month | Self-host wins |
| 500M | ~$67,500/month | ~$11,520/month | Self-host wins clearly |

Break-even shifts depending on your comparison: vs. Claude Opus, ~2–5M tokens/day; vs. Claude Sonnet, ~10–20M; vs. cheap APIs (DS V4 Flash at $0.14/$0.28 per million), ~500M+ — nearly unreachable on a single cluster. What cost ~$500/month a year ago now costs ~$50 — the API "cost collapse" keeps eroding the case for self-hosting.

### The Decision: 5 Situations Worth Self-Hosting (the Other 95% Should Use an API)

Drawn from analyzing 500+ real AI deployments: **95% of cases should use an API.** Only self-host if you fall into one of these 5 situations:

1. **Very high, sustained traffic (>50M tokens/day)** while maintaining >70% GPU utilization.
2. **Mandatory data residency** — HIPAA, SOC 2, air-gapped environments, or region-specific personal data laws.
3. **A fine-tuned model on proprietary data** you can't or won't put on a third-party API.
4. **Steady bulk workloads** (classification, embeddings, extraction) — uniform load, low complexity.
5. **A specific model/version unavailable via any API** — a frozen version for a legacy pipeline, or a need for full control over the inference pipeline.

**Don't fall into any of these 5? Use an API.** You'll save weeks of engineering time and sleep better.

### If You Do Self-Host: Ship It Right

Pick your engine by purpose: **vLLM** for multi-user production (PagedAttention lifts GPU utilization from 24%→98.5%); **SGLang** for large MoE models or structured output; **llama.cpp**/**Ollama** for dev/prototyping only — **don't use Ollama in production** (it lacks real continuous batching).

Getting the model running is only layer one of four:

```
┌─────────────────────────────────────────┐
│  L4: INTERFACE — Chat UI, API gateway    │
├─────────────────────────────────────────┤
│  L3: RAG & KNOWLEDGE — Vector DB, Search │
├─────────────────────────────────────────┤
│  L2: SECURITY — SSO, RBAC, ACL, PII mask │
├─────────────────────────────────────────┤
│  L1: INFERENCE — vLLM/SGLang + GPU + Mon │
└─────────────────────────────────────────┘
```

A realistic rollout: Step 0 — prototype on a free-tier API ($0, 1 day); Step 1 — ship production v1 on a cheap API (~$5–50/month, 1 week); Step 2 — if data residency is required, 1× RTX 4090 + a small model + vLLM (~$1,600 + setup, 2 weeks); Step 3 — once volume passes 10M tokens/day, evaluate a 4× H100 cluster (1 month). Most 2026 production systems don't choose "all self-hosted" or "all API" — they run **hybrid**: cheap self-hosted models for bulk tasks, frontier APIs for hard tasks, routed through a simple dispatcher.

### Pitfalls & Lessons Learned

This is the section worth reading most carefully — real experience you won't find in official docs.

The break-even table above is still *optimistic* — it excludes these costs:

| Item | Real cost |
| :--- | :--- |
| GPU idle time | GPU at 10% load → per-token cost jumps **10×** |
| Setup | 2–4 weeks of senior ML engineer time |
| Maintenance | 8–20 hours/month of engineering time |
| Power + cooling | $500–4,000/month for a 4–8× H100 cluster |

> ##### A case study worth remembering
> One company self-hosted on 4× A10G at $5,175/month. The equivalent API cost only $1,870/month. They paid **2.8× more** for their "cost-saving" solution.
{: .block-danger}

**What I considered and rejected — with reasons:**

- **Self-hosting everything to avoid API dependency** — considered out of vendor-lock-in concerns, but rejected: the economics only clearly win above ~50M tokens/day, most products never reach that threshold, and the operational risk (OOM incidents, 2am pages) isn't worth trading for an independence you don't yet need.
- **Ollama in production because setup is easy** — considered because the team wasn't familiar with vLLM, but rejected: it lacks real PagedAttention/continuous batching, so throughput falls short once multiple users hit it concurrently. Use Ollama for demos, switch to vLLM before real users arrive.
- **Skipping data residency because "no one will check"** — considered to save setup time, but rejected: the legal exposure (regional data protection law, or HIPAA/SOC 2 depending on industry) isn't worth it — compliance costs later are always higher than doing it right from the start.
- **On-demand cloud GPUs instead of reserved** — considered for flexibility, but rejected for uneven traffic: GPU at 10% utilization already pushes per-token cost up 10×, so on-demand doesn't save as much as it seems unless you can keep utilization consistently high.

### Conclusion

Three questions before you decide: (1) How many tokens/day are you processing — under 10M means API, over 50M means self-hosting is worth considering; (2) Is your data required to be air-gapped — yes means self-hosting is mandatory, no means an API is safer (less operational burden); (3) Does your team have MLOps capacity — no means API, yes means run a 12-month ROI calculation before deciding.

Don't self-host because it "sounds cheaper." Self-host because **the numbers show it's cheaper** — after fully accounting for idle cost, engineering time, and opportunity cost. If you do decide to self-host, see my companion post on [KV Cache in Production](/synthesis/2026/kv-cache-deep-dive/) to size VRAM correctly before you deploy. If you have more recent numbers or a different take, I'd genuinely welcome it in the comments.

---

## Nguồn tham khảo

*Dùng chung cho cả 2 bản / Shared reference list for both language versions.*

1. [Onyx AI — Self-Hosted LLM Leaderboard](https://onyx.app/self-hosted-llm-leaderboard)
2. [BenchLM — Best Chinese LLMs 2026](https://benchlm.ai/blog/posts/best-chinese-llm)
3. [Hugging Face — DeepSeek V4 Pro Model Card](https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro)
4. [Spheron — GPU Memory Requirements for LLMs](https://www.spheron.network/blog/gpu-memory-requirements-llm/)
5. [DEV.to — The Math Behind Local LLMs VRAM](https://dev.to/bytecalculators/the-math-behind-local-llms-how-to-calculate-exact-vram-requirements-before-you-crash-your-gpu-12n5)
6. [Braincuber — Self-Hosted vs API LLMs: Real Cost Breakdown 2026](https://www.braincuber.com/blog/self-hosted-llms-vs-api-based-llms-cost-performance-analysis)
7. [SitePoint — Self-Hosted LLM Costs 2026](https://www.sitepoint.com/self-hosted-llm-costs-2026/)
8. [DevTk.AI — Self-Host LLM vs API Cost 2026](https://devtk.ai/en/blog/self-hosting-llm-vs-api-cost-2026/)
9. [TokenMix — Self-Host LLM vs API Break-Even](https://tokenmix.ai/blog/self-host-llm-vs-api)
10. [PE Collective — LLM API Pricing 2026](https://pecollective.com/blog/llm-api-pricing-comparison/)
11. [MarkTechPost — Kimi K2.6 Release](https://www.marktechpost.com/2026/04/20/moonshot-ai-releases-kimi-k2-6-with-long-horizon-coding-agent-swarm-scaling-to-300-sub-agents-and-4000-coordinated-steps/)
12. [AIMadeTools — GLM-5.1 vs DeepSeek vs Qwen Coding](https://www.aimadetools.com/blog/glm-5-1-vs-deepseek-vs-qwen-coding/)
13. [LMCache — KV Cache Size Calculator](https://lmcache.ai/kv_cache_calculator.html)
14. [LocalLLM — llama.cpp VRAM Requirements Guide](https://localllm.in/blog/llamacpp-vram-requirements-for-local-llms)
15. [Rene Zander — Self-Hosted LLM vs API Break-Even 2026](https://renezander.com/guides/self-hosted-llm-vs-api/)

---

*Cập nhật / Updated: 24/07/2026. Mọi con số có thể thay đổi nhanh — verify trước khi ra quyết định ngân sách. / Numbers move fast in this space — verify before making a budget decision.*
