---
layout: post
title: "self-hosted LLM"
date: 2026-05-05 22:24:00
description: Tự triển khai LLM — khi nào nên làm, chọn model gì, cần bao nhiêu GPU và những con số mà không ai nói trước.
tags: infrastructure self-host production
categories: AI
toc:
  sidebar: top
---

Tháng 5/2026, các model open-weight đạt hiệu năng ngang hàng với model đóng (Claude, GPT) trên hầu hết benchmark coding và reasoning. Khoảng cách SWE-bench giữa best open-weight (Kimi K2.6: 80.2%) và Claude Opus 4.6 (80.8%) chỉ còn **0.6%**. Trong khi đó, chi phí API open-weight rẻ hơn 5–70 lần.

Điều này khiến câu hỏi "có nên tự host LLM?" trở nên thực tế hơn bao giờ hết. Nhưng câu trả lời không đơn giản là "có" hay "không" — nó phụ thuộc vào con số, và phần lớn các developer tôi thấy đang tính nhầm.

> Bài viết này tổng hợp dữ liệu từ Onyx AI Leaderboard, các model card chính thức (Hugging Face), và phân tích chi phí từ nhiều nguồn thực tế. Mọi con số đều có context cụ thể — không có "model tốt nhất".

## Landscape 05/2025

Bức tranh open-weight đầu 2026 thay đổi rất nhanh. Chỉ trong Q1–Q2/2026, đã có ít nhất 4 bản nâng cấp lớn:

- **Kimi K2.5 → K2.6** (Moonshot AI, 20/4/2026)
- **DeepSeek V3.2 → V4 Pro/Flash** (DeepSeek, 24/4/2026)
- **GLM-5 → GLM-5.1** (Z.AI, 4/2026)
- **Qwen 3.5 → Qwen 3.6** (Alibaba, 4/2026)

Nếu bạn đang đọc một bài so sánh model mà không ghi ngày cập nhật, rất có thể thông tin đã cũ.

### Bảng model chính (05/2026)

| Model             | Tổng Params | Active/token | Kiến trúc   |  Context | License |
| :---------------- | ----------: | -----------: | :---------- | -------: | :------ |
| DeepSeek V4 Pro   |      1.600B |          49B | MoE CSA+HCA |   **1M** | <span class="bdg bdg-mit">MIT</span> |
| Kimi K2.6         |      1.000B |          32B | MoE 384E    |     262K | <span class="bdg bdg-mit">MIT+</span> |
| GLM-5.1           |        744B |          40B | MoE 256E    |     200K | <span class="bdg bdg-mit">MIT</span> |
| Qwen 3.5          |        397B |          17B | MoE         |        — | <span class="bdg bdg-apache">Apache</span> |
| GLM-4.7           |        355B |          32B | MoE         |     200K | <span class="bdg bdg-mit">MIT</span> |
| Llama 4 Maverick  |        400B |          17B | MoE 128E    |        — | <span class="bdg bdg-llama">Llama 4</span> |
| DeepSeek V4 Flash |        284B |          13B | MoE CSA+HCA |   **1M** | <span class="bdg bdg-mit">MIT</span> |
| Llama 4 Scout     |        109B |          17B | MoE 16E     |  **10M** | <span class="bdg bdg-llama">Llama 4</span> |
| GLM-4.7 Flash     |        ~30B |        Dense | Distilled   |     200K | <span class="bdg bdg-mit">MIT</span> |

Một vài điểm đáng chú ý:

- **Hầu hết model frontier đều là MoE.** Kimi K2.6 có 1 nghìn tỷ tham số nhưng chỉ kích hoạt 32B cho mỗi token — giảm 96.8% computation. Đây là lý do tại sao bạn không thể so sánh model chỉ dựa trên "số B".

- **Context window đang bùng nổ.** Llama 4 Scout claim 10M token, DeepSeek V4 hỗ trợ 1M. Nhưng context dài có giá: KV cache ngốn VRAM tuyến tính theo số token. Thực tế production, hầu hết deployment giới hạn ở 128K–256K vì lý do phần cứng.

- **MIT license chiếm ưu thế.** GLM-5.1, DeepSeek V4, Kimi K2.6 đều MIT — tự do thương mại hóa, fine-tune, redistribution. Qwen 3.5 dùng Apache 2.0, Llama 4 có giới hạn ở 700M MAU.

## Tính VRAM 

> Đây là phần quan trọng nhất trong toàn bộ bài viết.

### Công thức cơ bản

$$
\text{VRAM MIN} = \text{Weights} + \text{KV Cache} + \text{Activations} + \text{Framework Overhead}
$$

**Weights** (phần dễ tính):

| Precision |  Bytes/param | VD: GLM-5.1 (744B) |
| :-------- | :----------- | :-------------------- |
| FP16/BF16 |          2.0 |              1.488 GB |
| FP8       |          1.0 |   ~860 GB (có overhead) |
| INT4      |          0.5 |               ~386 GB | 

Hầu hết mọi người dừng ở đây. Đó là sai lầm.

### KV Cache

Mỗi token trong context cần lưu 2 vector (Key và Value) cho **mỗi layer**, **mỗi KV head**. Công thức:

$$
\text{KV Cache} = 2 \times \text{seq_len} \times n_{\text{layers}} \times n_{\text{kv_heads}} \times d_{\text{head}} \times \text{bytes}
$$

Giải thích từng thành phần:

- **2** — mỗi token cần lưu cả Key lẫn Value
- **seq_len** — số token trong context (ví dụ 4K = 4,096 token)
- **$n_{\text{layers}}$** — số transformer layer (Llama 3.3 70B có 80 layers)
- **$n_{\text{kv\_heads}}$** — số KV heads. Lưu ý: nhờ GQA (Grouped-Query Attention), con số này **nhỏ hơn nhiều** so với số Q heads. Llama 3.3 70B có 64 Q heads nhưng chỉ **8 KV heads**
- **$d_{\text{head}}$** — kích thước mỗi head (128)
- **bytes** — số byte mỗi phần tử (BF16 = 2 bytes)

Ví dụ tính tay cho Llama 3.3 70B ở 4K context:

$$
2 \times 4{,}096 \times 80 \times 8 \times 128 \times 2 = 1{,}342{,}177{,}280 \text{ bytes} \approx 1.3 \text{ GB}
$$

Bảng đầy đủ với Llama 3.3 70B (80 layers, **8 KV heads**, head dim 128, BF16):

| Context    | KV Cache (BF16) | So sánh                          |
| :--------- | --------------: | :------------------------------- |
| 4K token   |          1.3 GB | Nhỏ, thoải mái                  |
| 32K token  |         10.7 GB | Khoảng 13% card H100 80 GB      |
| 128K token |    **42.9 GB**  | Chiếm hơn nửa H100, gần bằng 1/3 weights FP16 (140 GB) |

Với model nhỏ hơn — Llama 3.1 8B (32 layers, 8 KV heads, head dim 128) — ở 128K context:

$$
2 \times 131{,}072 \times 32 \times 8 \times 128 \times 2 \approx 16 \text{ GB}
$$

**16 GB KV cache** — lớn hơn cả weights ở FP16 (14 GB). Đây là lý do vì sao "model nhỏ + context dài" không hề nhẹ như nhiều người nghĩ.

**Và khi có nhiều user đồng thời, mỗi user cần KV cache riêng:**

| Concurrent users | 70B @ 4K ctx | 70B @ 32K ctx |
| :--------------: | -----------: | ------------: |
| 1                |       1.3 GB |       10.7 GB |
| 5                |       6.7 GB |       53.7 GB |
| 10               |      13.4 GB |      107.4 GB |

Kịch bản thực tế: bạn deploy Llama 3.3 70B INT4 (~37 GB weights) trên 1× H100 80 GB, nghĩ rằng còn dư ~43 GB cho cache. Với 4 user @ 32K context, cache đã cần ~43 GB — **vừa khít, không còn chỗ cho overhead**. Thêm 1 user nữa là OOM crash.

> ##### WARNING
>
> Luôn tính $\text{VRAM} = \text{weights} + (\text{KV cache} \times \text{concurrent users}) + 10\text{–}20\%$ overhead. Dùng PagedAttention (vLLM) để tối ưu, và cân nhắc FP8 cho KV cache để giảm 50%.
{: .block-warning }

### Với model MoE: toàn bộ tham số phải nằm trong VRAM

Đây là hiểu lầm phổ biến. Kimi K2.6 chỉ kích hoạt 32B/token, nhưng toàn bộ 1T tham số phải nằm sẵn trên các GPU trong cluster (không phải CPU), vì bất kỳ token nào cũng có thể được route đến bất kỳ expert nào, do đó không thể rely vào việc load expert động từ CPU trong quá trình inference.

### Băng thông quan trọng hơn dung lượng

Tốc độ sinh token phụ thuộc vào **memory bandwidth**, không phải VRAM size:

$$
\text{Tokens/sec} \approx \frac{\text{Memory Bandwidth (GB/s)}}{\text{Model Size in Memory (GB)}}
$$

| Phần cứng              |   Bandwidth | 70B INT4 (~37GB) | Phù hợp          |
| :--------------------- | ----------: | ---------------: | :--------------- |
| DDR4 RAM (CPU offload) |   ~50 GB/s  |         ~1.3 t/s | Không dùng được  |
| DDR5 (Mac M4 Ultra)    |  ~800 GB/s  |          ~21 t/s | Dev/prototype    |
| RTX 4090 GDDR6X        | ~1.008 GB/s |          ~27 t/s | Solo dev         |
| H100 HBM3              | ~3.350 GB/s |          ~90 t/s | Production       |
| H200 HBM3e             | ~4.800 GB/s |         ~130 t/s | High-throughput  |


Chạy model 70B trên RAM hệ thống (CPU offload) cho ~1–3 token/giây — tức phải đợi 30–60 giây cho mỗi câu trả lời ngắn. Đủ để test, không đủ cho production.

## Matrix phần cứng đến model

Câu hỏi đúng không phải "model nào tốt nhất?" mà là **"GPU nào bạn đang có?"**

| Cấu hình         |     VRAM | Model production                       | Use case                        |
| :--------------- | -------: | :------------------------------------- | :------------------------------ |
| 1× RTX 3060 12GB |    12 GB | GLM-4.7 Flash (INT4)                   | POC, chatbot nội bộ đơn giản    |
| 1× RTX 4090 24GB |    24 GB | GLM-4.7 Flash (Q8), DS-R1-Distill-32B  | Solo dev, coding assistant      |
| 1× H100 80GB     |    80 GB | Llama 4 Scout (INT4), DS V4 Flash      | Team nhỏ, document processing   |
| 4× H100 80GB     |   320 GB | GLM-4.7 (FP8), Qwen 3.5 (INT4)        | Enterprise entry-tier           |
| 4× H200 141GB    |   564 GB | Kimi K2.6 (INT4), DS V4 Pro (chật)    | Frontier open-weight            |
| 8× H100 80GB     |   640 GB | GLM-5.1 (FP8), DS V4 Pro (FP8)        | Enterprise full-scale           |
| 8× H200 141GB    | 1.128 GB | Mọi model (BF16 thoải mái)             | Maximum flexibility             |


**Ghi chú thực tế:**

- VRAM trên là maximum cho weights. Production cần trừ đi KV cache cho N user concurrent.
- 4× H100 là điểm khởi đầu thực tế cho cluster-tier enterprise.
- Mac Studio M4 Ultra (192GB unified) chạy được GLM-4.7 GGUF 2-bit (~135 GB) nhưng tốc độ chậm hơn H100 khoảng 3–5×. Phù hợp dev, không phù hợp serving.


## Bài toán kinh tế
### Con số shock

Ở mức 1M token/ngày, self-host trên cloud GPU đắt hơn API **733 lần**.

Đọc lại câu trên.

Đây là lý do: GPU cloud tính tiền theo giờ, bất kể bạn dùng bao nhiêu. 4× H100 trên cloud giá ~$16–32/ngày = $11.520/tháng. Nếu bạn chỉ xử lý 1M token/ngày, chi phí per-token thực tế là $0.38/1K token — đắt hơn Claude Opus rất nhiều.

### Bảng so sánh thực tế

| Token/ngày | Claude Sonnet <br>($3/$15M) | DS V4 Flash <br>($0.14/$0.28M) | Self-host 4×H100 | Kết luận           |
| :--------- | ----------------------: | -------------------------: | ----------------: | :------------------------ |
| 100K       |              ~$14/tháng |                ~$0.6/tháng |    ~$11.520/tháng | API rẻ hơn 800×           |
| 1M         |             ~$135/tháng |                  ~$6/tháng |    ~$11.520/tháng | API rẻ hơn 85×            |
| 10M        |           ~$1.350/tháng |                 ~$63/tháng |    ~$11.520/tháng | API vẫn rẻ hơn            |
| 50M        |           ~$6.750/tháng |                ~$315/tháng |    ~$11.520/tháng | Hòa vốn vs Claude         |
| 100M       |          ~$13.500/tháng |                ~$630/tháng |    ~$11.520/tháng | Self-host thắng vs Claude |
| 500M       |          ~$67.500/tháng |              ~$3.150/tháng |    ~$11.520/tháng | Self-host thắng rõ ràng   |


**Break-even thay đổi tùy bạn so với ai:**

- Vs Claude Opus ($5/$25M): ~2–5M token/ngày
- Vs Claude Sonnet ($3/$15M): ~10–20M token/ngày
- Vs DS V4 Flash ($0.14/$0.28M): ~500M+ token/ngày — gần như bất khả thi trên 1 cluster

> ##### TIP
>
> Khi so với API budget (DS V4 Flash, GPT-4.1 Nano), break-even gần như không đạt được. Self-host chỉ có lợi khi so với API frontier đắt tiền và lưu lượng đủ lớn.
{: .block-tip }

### Chi phí ẩn mà không ai nói trước

| Hạng mục      | Chi phí thực tế                              | Giải thích                                            |
| :------------ | :------------------------------------------- | :---------------------------------------------------- |
| GPU idle      | GPU ở 10% load → cost per-token tăng **10×** | Bạn trả tiền GPU 24/7 nhưng traffic chỉ 8h/ngày       |
| Setup         | 2–4 tuần senior ML engineer                  | vLLM, monitoring, load balancing, CI/CD               |
| Bảo trì       | 8–20 giờ/tháng engineering time              | Model upgrade, incident response, tuning              |
| Điện + cooling | $500–4.000/tháng                            | Cho cụm 4–8× H100 chạy 24/7                           |

> ##### DANGER
>
> Một case study đáng chú ý: một công ty đã tự host model trên 4× A10G GPU, tốn \\$5.175/tháng. API tương đương chỉ \\$1.870/tháng. Họ trả **2.8× nhiều hơn** cho "giải pháp tiết kiệm".
{: .block-danger }

## Khi nào thực sự nên self-host

95% trường hợp nên dùng API. Con số này không phải hedging — nó đến từ phân tích 500+ AI deployment thực tế.

**5 trường hợp nên self-host:**

### Lưu lượng cực lớn (>50M token/ngày, tải ổn định)

Ở 100M token/ngày, self-host 70B trên cluster rẻ hơn Claude Sonnet khoảng \\$2.000/tháng. Ở 500M token/ngày, tiết kiệm \\$50K+/tháng. Nhưng phải đảm bảo GPU utilization >70%.

### Data residency bắt buộc

HIPAA (y tế Mỹ), SOC 2 (tài chính), air-gapped (quốc phòng) — dữ liệu không được rời infra. Không có lựa chọn khác ngoài self-host. Với doanh nghiệp Việt Nam: Nghị định 13/2023 về bảo vệ dữ liệu cá nhân có thể yêu cầu xử lý dữ liệu người Việt tại Việt Nam, tùy loại dữ liệu.

### Fine-tuned model trên dữ liệu nội bộ

Bạn sở hữu weights đã train trên data riêng. Không thể deploy lên API người khác (trừ OpenAI/Mistral fine-tuning API, nhưng giá cao hơn).

### Bulk tasks đều đặn (phân loại, embedding, extraction)

Workload đều, complexity thấp, GPU luôn >70% utilization. Model nhỏ (Phi-4, GLM-4.7 Flash) trên 1× RTX 4090 là đủ.

### Model/version cụ thể không có sẵn trên API

Frozen version cho legacy pipeline, model hiếm trên Hugging Face, hoặc cần kiểm soát inference pipeline hoàn toàn.

**Nếu không rơi vào 5 trường hợp trên: dùng API.**

## Inference engine 

Model tốt chạy trên framework sai vẫn chậm. Đây là so sánh thực tế:

| Engine        | Throughput (70B, 2×A100) | Concurrent       | Production | Đặc điểm                                          |
| :------------ | :----------------------- | :--------------- | :--------- | :------------------------------------------------ |
| **vLLM**      | 40–60 t/s/req, 20+ user  | 100+ req/min     | <span class="bdg bdg-prod">PROD</span> | PagedAttention tăng utilization từ 24% → 98.5% |
| **SGLang**    | 35–55 t/s/req            | 50+ req/min      | <span class="bdg bdg-prod">PROD</span> | RadixAttention, Expert Parallelism cho MoE |
| **TGI**       | 30–50 t/s/req            | 50+ req/min      | <span class="bdg bdg-prod">PROD</span> | Docker-native, Hugging Face ecosystem |
| **llama.cpp** | 15–40 t/s (single GPU)   | 1–5 req          | <span class="bdg bdg-dev">DEV</span>  | CPU+GPU offload, GGUF format |
| **Ollama**    | 10–35 t/s                | 1–3 req          | <span class="bdg bdg-no">NO</span>    | 1 lệnh install, tốt cho prototype |


**Quy tắc đơn giản:**

- Production, nhiều user → **vLLM**
- MoE model lớn, structured output → **SGLang**
- Dev/prototype, Mac, edge → **llama.cpp / Ollama**
- Đừng dùng Ollama cho production

### Về parallelism cho model MoE trên multi-GPU

Khi chạy MoE trên cluster, cần kết hợp:

- **Tensor Parallelism (TP):** chia layer ngang trên GPU — dùng cho mọi model multi-GPU
- **Expert Parallelism (EP):** phân bổ expert lên GPU khác nhau — chỉ cho MoE
- **Pipeline Parallelism (PP):** chia theo stages — cho cluster rất lớn

Ví dụ: Kimi K2.6 (384 expert) trên 8× H100: mỗi GPU chứa 48 expert, TP=8. Nếu thiếu EP, tất cả GPU đều load toàn bộ expert → lãng phí VRAM.

## Stack production 

Chạy được model mới chỉ là Layer 1 trên 4:

```

┌─────────────────────────────────────────┐
│  L4: GIAO DIỆN                          │
│  Chat UI, Slack bot, API gateway        │
├─────────────────────────────────────────┤
│  L3: RAG & KNOWLEDGE                    │
│  Vector DB + Hybrid Search + Connectors │
│  (Google Drive, Slack, Jira, Confluence)│
├─────────────────────────────────────────┤
│  L2: BẢO MẬT & PHÂN QUYỀN               │
│  SSO + RBAC + Document-level ACL        │
│  PII masking + Audit log                │
├─────────────────────────────────────────┤
│  L1: INFERENCE ENGINE                   │
│  vLLM/SGLang + Load Balancer            │
│  + GPU Cluster + Monitoring             │
└─────────────────────────────────────────┘

```

> ##### WARNING
>
> Rủi ro lớn nhất của DIY stack: **nhân viên dùng AI truy vấn tài liệu họ không có quyền xem.** Nếu không có ACL kế thừa từ hệ thống gốc (Drive, Jira), đây là lỗ hổng compliance nghiêm trọng.
{: .block-warning }

## Benchmark 

Một vài con số đáng chú ý:

| Model            | SWE-bench Verified      | LiveCodeBench | GPQA Diamond |
| :--------------- | ----------------------: | ------------: | -----------: |
| DS V4 Pro Max    |              **80.6%**  |      **93.5** |            — |
| Kimi K2.6        |                  80.2%  |          89.6 |        90.5% |
| GLM-5.1          | — (SWE-Pro: **58.4%**)  |             — |            — |
| Qwen 3.5         |                      —  |             — |    **88.4%** |
| Claude Opus 4.6* |                  80.8%  |          88.8 |            — |
| GPT-5.4*         |   — (SWE-Pro: 57.7%)    |             — |        92.8% |


_\* Model đóng, đưa vào để so sánh tham chiếu._

**Cảnh báo quan trọng:** Benchmark phụ thuộc rất nhiều vào harness. GPT-5.4 đạt 65.4% trên Terminal-Bench 2.0 với Terminus-2 harness, nhưng 75.1% với Codex CLI. Cùng model, khác harness, khác 10% tuyệt đối.

> ##### TIP
>
> Luôn test trên workload thật. Không có model "tốt nhất chung chung" — chỉ có "tốt nhất cho task của bạn trên dữ liệu của bạn".
{: .block-tip }

## Giá API 05/2026

| Model            |  Input ($/M) | Output ($/M) | So với Claude Opus       |
| :--------------- | -----------: | -----------: | :----------------------- |
| DS V4 Flash      |    **$0.14** |    **$0.28** | Rẻ hơn ~70×              |
| GLM-4.7 Flash    |        $0.07 |        $0.40 | Rẻ hơn ~60× (có free tier) |
| Kimi K2.6        |        $0.60 |        $2.50 | Rẻ hơn ~10×              |
| GLM-5.1          |        $1.00 |        $3.20 | Rẻ hơn ~7×               |
| DS V4 Pro        |        $1.74 |        $3.48 | Rẻ hơn ~6×               |
| Claude Sonnet 4.6 |       $3.00 |       $15.00 | Tham chiếu               |
| Claude Opus 4.6  |        $5.00 |       $25.00 | Tham chiếu               |

Những gì tốn \\$500/tháng năm ngoái, năm nay tốn $50. Đây là "cost collapse" — xu hướng không dừng lại.

## Khuyến nghị thực tế

### Bắt đầu

| Bước        | Hành động                                                              |        Chi phí | Thời gian |
| :---------- | :--------------------------------------------------------------------- | -------------: | --------: |
| **Bước 0**  | Dùng GLM-4.7 Flash API (free tier) để prototype                        |             $0 |    1 ngày |
| **Bước 1**  | Dùng DS V4 Flash API cho production v1                                 |  ~$5–50/tháng  |    1 tuần |
| **Bước 2**  | Nếu cần data residency: 1× RTX 4090 + GLM-4.7 Flash + vLLM             | ~$1.600 + setup |   2 tuần |
| **Bước 3**  | Khi volume >10M token/ngày: đánh giá 4× H100 cluster                   | ~$100K hoặc cloud |  1 tháng |

### Hybrid là phương án tối ưu nhất

Đa số hệ thống production thực sự trong 2026 dùng:

- **Self-host model rẻ** (DS V4 Flash, GLM-4.7 Flash) cho bulk tasks: phân loại, embedding, extraction
- **API frontier** (Claude Sonnet/Opus, GPT-5.4) cho task khó: reasoning phức tạp, customer-facing

Một router đơn giản giữa hai tầng. Đó là architecture mà hầu hết team thực sự đang ship.

### Lưu ý về địa chính trị

Hầu hết model frontier open-weight (Kimi, DeepSeek, GLM, Qwen, MiniMax) đều của Trung Quốc. Với khách hàng Mỹ/EU, đây có thể là vấn đề compliance. Với startup Việt Nam, thường là lợi thế: MIT/Apache license, giá rẻ, hỗ trợ tiếng Việt/Trung tốt. Meta (Llama) là lựa chọn Mỹ duy nhất có sức cạnh tranh, nhưng license có giới hạn.

<br>

---

Self-hosted LLM năm 2026 không còn là "liệu có khả thi?" — mà là "liệu có đáng cho use case cụ thể của bạn?"

Ba câu hỏi trước khi quyết định:

1. **Bạn xử lý bao nhiêu token/ngày?** Dưới 10M → API. Trên 50M → cân nhắc self-host. Trên 100M → self-host rõ ràng rẻ hơn.
2. **Dữ liệu có nhạy cảm đến mức phải air-gap?** Có → self-host bắt buộc. Không → API an toàn hơn (ít gánh nặng vận hành).
3. **Team có MLOps?** Không → API. Có → tính ROI 12 tháng rồi quyết.

Đừng self-host vì "nghe tưởng rẻ hơn". Hãy self-host vì con số cho thấy nó rẻ hơn — sau khi đã tính đủ idle cost, engineering time và cơ hội bỏ lỡ.

---

### Nguồn tham khảo

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

_Cập nhật: 05/2026. Mọi con số có thể thay đổi nhanh — verify trước khi ra quyết định ngân sách._
