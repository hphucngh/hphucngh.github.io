---
layout: post
title: "KV Caching Explained"
date: 2026-05-07
description: Giải thích về KV Cache — tại sao cần nó, công thức tính chính xác, đến các kỹ thuật tối ưu production. Với ví dụ tính thực tế trên Llama, DeepSeek, Kimi 2026.
tags: [AI, LLM, KV-cache, inference, VRAM, optimization]
categories: AI
giscus_comments: true
related_posts: true
toc:
  sidebar: left
---

> Bài viết tổng hợp từ [KV Caching Explained (Hugging Face)](https://huggingface.co/blog/not-lain/kv-caching), [Mastering LLM Techniques (NVIDIA)](https://developer.nvidia.com/blog/mastering-llm-techniques-inference-optimization/), cùng dữ liệu model 2026. Mục tiêu: đọc xong, bạn tính được chính xác VRAM cần thiết cho bất kỳ cấu hình nào.

---

## 1. Tại sao cần KV Cache

### LLM sinh text từng token một

Khi bạn hỏi ChatGPT hay bất kỳ LLM nào, câu trả lời không xuất hiện cùng lúc. Model sinh **từng token một** (autoregressive). Mỗi token mới phụ thuộc vào **tất cả** token trước đó.

```bash

Input:  "Hà Nội là"
Step 1: sinh "thủ"     ← nhìn lại "Hà Nội là"
Step 2: sinh "đô"      ← nhìn lại "Hà Nội là thủ"
Step 3: sinh "của"     ← nhìn lại "Hà Nội là thủ đô"
Step 4: sinh "Việt"    ← nhìn lại "Hà Nội là thủ đô của"
Step 5: sinh "Nam"     ← nhìn lại "Hà Nội là thủ đô của Việt"

```

### Không có cache: tính lại từ đầu mỗi bước

Trong cơ chế attention, model cần tính 3 ma trận cho mỗi token: **Query (Q)**, **Key (K)**, và **Value (V)**. Sau đó dùng $$(Q. K^T)$$ để tính attention scores, rồi nhân với V để ra output.

**Không có cache,** mỗi khi sinh token mới, model phải **tính lại Q, K, V cho toàn bộ chuỗi** từ đầu:

```bash

Step 1: Tính Q,K,V cho ["Hà","Nội","là"]            → 3 token
Step 2: Tính Q,K,V cho ["Hà","Nội","là","thủ"]      → 4 token (3 bị tính lại)
Step 3: Tính Q,K,V cho ["Hà","Nội","là","thủ","đô"] → 5 token (4 bị tính lại)
...
Step N: Tính Q,K,V cho toàn bộ N token              → N-1 bị tính lại

```

### Có cache: chỉ tính token mới

Nhận thấy: K và V của token cũ **không thay đổi** giữa các bước (vì masked attention chỉ nhìn lại, không nhìn tới). Vậy tại sao phải tính lại?

**KV Cache** lưu K,V đã tính vào bộ nhớ GPU. Mỗi bước chỉ cần:
1. Tính Q, K, V cho **1 token mới**
2. Nối K, V mới vào cache
3. Dùng Q mới + toàn bộ K,V trong cache → tính attention → ra output

```bash

Step 1: Tính K,V cho ["Hà","Nội","là"] → Cache: [K₁K₂K₃], [V₁V₂V₃]
Step 2: Tính K₄,V₄ cho ["thủ"]         → Cache: [K₁K₂K₃K₄], [V₁V₂V₃V₄]
Step 3: Tính K₅,V₅ cho ["đô"]          → Cache: [K₁K₂K₃K₄K₅], [V₁V₂V₃V₄V₅]

```

### Benchmark thực tế

Trên GPU T4, model SmolLM2-1.7B, sinh 300 token:

| | Thời gian | Speedup |
|---|---|---|
| Không cache | 61 giây | Baseline |
| Có KV cache | 11.7 giây | **5.2× nhanh hơn** |

<br>
Với model lớn hơn và context dài hơn, speedup còn cao hơn nhiều (10–50×).

---

## 2. KV Cache 

### Cấu trúc

Mỗi **layer** trong transformer tạo K và V riêng. Với model 80 layer (Llama 3.3 70B), có 80 cặp [K, V] cache riêng biệt.

```bash

Layer 1:  "Cache_K₁" = [k¹₁, k¹₂, ..., k¹ₙ],  "Cache_V₁" = [v¹₁, v¹₂, ..., v¹ₙ]
Layer 2:  "Cache_K₂" = [k²₁, k²₂, ..., k²ₙ],  "Cache_V₂" = [v²₁, v²₂, ..., v²ₙ]
...
Layer 80: "Cache_K₈₀" = [k⁸⁰₁, k⁸⁰₂, ..., k⁸⁰ₙ], "Cache_V₈₀" = [v⁸⁰₁, v⁸⁰₂, ..., v⁸⁰ₙ]

```

Tổng shape: `[num_layers, 2, batch_size, num_kv_heads, seq_len, head_dim]`

### KV cache lưu ở VRAM

KV cache nằm hoàn toàn trên **VRAM của GPU** — cùng chỗ với model weights. Đây là lý do nó cạnh tranh trực tiếp với weights cho không gian bộ nhớ.

---

## 3. Công thức tính 

### Công thức gốc (từ NVIDIA)

```
KV cache cho 1 token (bytes) = 2 × num_layers × num_kv_heads × head_dim × bytes_per_element
```

| Thành phần | Giải thích |
|---|---|
| `2` | Cả Key lẫn Value |
| `num_layers` | Số tầng transformer (tìm trong config.json: `num_hidden_layers`) |
| `num_kv_heads` | Số KV heads (config.json: `num_key_value_heads`). Với GQA, nhỏ hơn query heads |
| `head_dim` | Chiều mỗi head = `hidden_size / num_attention_heads` |
| `bytes_per_element` | BF16 = 2, FP8 = 1, Q4 = 0.5 |

### Tổng KV cache

```
Tổng (bytes) = batch_size × seq_len × 2 × num_layers × num_kv_heads × head_dim × bytes_per_element
```

Hoặc dạng rút gọn (khi `num_kv_heads × head_dim = hidden_size` — đúng với MHA):

```
Tổng (bytes) = batch_size × seq_len × 2 × num_layers × hidden_size × bytes_per_element
```

**Chú ý:** Với GQA, `num_kv_heads` nhỏ hơn `num_attention_heads`, nên phải dùng công thức đầy đủ.

### Bảng tham số các model phổ biến

| Model | Layers | KV Heads | Head Dim | Hidden Size | Attention Type |
|---|---|---|---|---|---|
| Llama 3.1 8B | 32 | 8 | 128 | 4096 | GQA |
| Llama 3.3 70B | 80 | 8 | 128 | 8192 | GQA |
| DeepSeek V4 Flash | ~60 | ~8 | 128 | ~7168 | GQA + MLA |
| Kimi K2.6 | 61 | varies | 128 | ~5120 | MoE + MLA |
| GLM-5.1 | ~80 | ~8 | 128 | ~8192 | GQA |
| Qwen 3.5 (A17B) | ~80 | ~8 | 128 | ~5120 | GQA |
| Phi-4 14B | 40 | 10 | 128 | 5120 | GQA |

*(Giá trị xấp xỉ vì một số model chưa công bố config đầy đủ. Luôn kiểm tra config.json trên Hugging Face.)*

---

## 4. Tính thử — từ nhẹ nhàng đến choáng váng

### Ví dụ 1: Llama 3.1 8B (model nhỏ)

```
1 token = 2 × 32 × 8 × 128 × 2 bytes = 131.072 bytes ≈ 0.000125 GB
```

| Context | 1 user | 10 user | 50 user |
|---|---|---|---|
| 4K | 0.5 GB | 5 GB | 25 GB |
| 32K | 4 GB | 40 GB | 200 GB |
| 128K | **16 GB** | **160 GB** | 800 GB |

Model weights FP16 chỉ ~16 GB. Ở 128K context 1 user, KV cache đã **bằng weights**. Ở 10 user × 128K: KV cache = **10× weights**.

### Ví dụ 2: Llama 3.3 70B (model production phổ biến)

```
1 token = 2 × 80 × 8 × 128 × 2 bytes = 327.680 bytes ≈ 0.00031 GB
```

| Context | 1 user | 5 user | 10 user | 20 user |
|---|---|---|---|---|
| 4K | 1.3 GB | 6.5 GB | 13 GB | 26 GB |
| 8K | 2.6 GB | 13 GB | 26 GB | 52 GB |
| 32K | 10.2 GB | 51 GB | 102 GB | 204 GB |
| 128K | **40.6 GB** | 203 GB | **406 GB** | 812 GB |

### Ví dụ 3: Tổng VRAM cần cho 70B production

Kịch bản: Llama 3.3 70B INT4, 10 user, context 32K:

| Thành phần | Giá trị |
|---|---|
| Weights (INT4) | 37 GB |
| KV cache (10 user × 32K, BF16) | 102 GB |
| KV cache (10 user × 32K, **FP8**) | **51 GB** |
| Activations + overhead | ~5 GB |
| **Tổng (BF16 cache)** | **144 GB → 2× H100** |
| **Tổng (FP8 cache)** | **93 GB → 2× H100 (dư)** |

Quantize KV cache từ BF16 → FP8 tiết kiệm **51 GB** — có thể là sự khác biệt giữa cần 2 GPU và cần 3 GPU.

---

## 5. GQA, MQA — giảm KV cache từ gốc

### Vấn đề với Multi-Head Attention (MHA) cổ điển

MHA gốc: mỗi query head có riêng 1 key head và 1 value head. Model 70B với 64 query heads → 64 KV heads → KV cache cực lớn.

```
MHA cache/token = 2 × 80 × 64 × 128 × 2 = 2.621.440 bytes ≈ 0.0025 GB
```

Ở 128K context: `0.0025 × 131.072 = 327 GB` — chỉ cho 1 user!

### GQA: nhóm query heads chia sẻ KV heads

Grouped-Query Attention nhóm nhiều query heads chia sẻ ít KV heads hơn. Llama 3.3 70B: 64 query heads chia thành 8 nhóm, mỗi nhóm dùng chung 1 KV head → 8 KV heads.

```
GQA cache/token = 2 × 80 × 8 × 128 × 2 = 327.680 bytes ≈ 0.00031 GB
```

Giảm **8×** so với MHA!

### MQA: tất cả query heads dùng chung 1 KV head

Multi-Query Attention cực đoan hơn: chỉ 1 KV head cho tất cả query heads.

```
MQA cache/token = 2 × 80 × 1 × 128 × 2 = 40.960 bytes ≈ 0.000039 GB
```

Giảm **64×** so với MHA, nhưng chất lượng giảm đáng kể.

### So sánh trực quan — 70B model, context 128K, 1 user

| Attention | KV Heads | Cache 128K | So với MHA |
|---|---|---|---|
| **MHA** | 64 | **327 GB** | Baseline |
| **GQA** (Llama 3.3) | 8 | **40.6 GB** | Giảm 8× |
| **MQA** | 1 | **5.1 GB** | Giảm 64× |

GQA giữ ~99% chất lượng MHA mà cache giảm 8×. Đây là lý do **mọi model 2025-2026 đều dùng GQA**.

### Multi-Latent Attention (MLA) — thế hệ mới

DeepSeek V4 và Kimi K2.6 dùng **MLA** (Multi-Latent Attention) — nén K,V xuống không gian latent nhỏ hơn trước khi cache. Hiệu quả hơn cả GQA nhưng phức tạp hơn về kiến trúc.

---

## 6. Các kỹ thuật tối ưu KV Cache

### 6.1 Quantize KV cache

Giống như quantize weights, bạn có thể lưu cache ở precision thấp hơn:

| Cache precision | 70B, 10 user, 32K | Giảm | Chất lượng |
|---|---|---|---|
| BF16 (mặc định) | 102 GB | Baseline | 100% |
| FP8 | **51 GB** | −50% | ~99% |
| Q4_0 | **26 GB** | −75% | ~95% |

Cách bật trong **llama.cpp**:
```bash
llama-server --model model.gguf \
  --cache-type-k q4_0 \
  --cache-type-v q4_0 \
  --flash-attn \
  --ctx-size 32768
```

Cách bật trong **vLLM**:
```bash
vllm serve model --kv-cache-dtype fp8
```

Qwen 3.5 series xử lý KV cache quantization đặc biệt tốt nhờ GQA tối ưu — giảm 50% VRAM cache mà output gần như không đổi.

### 6.2 PagedAttention — loại bỏ lãng phí

**Vấn đề:** Cách truyền thống cấp KV cache tĩnh, contiguous (liền mạch) cho max sequence length. Model hỗ trợ 128K nhưng request dùng 2K → 126K slot bị lãng phí. Gây 3 loại lãng phí:

- **Reserved waste:** Bộ nhớ giữ chỗ cho cả context nhưng chưa dùng
- **Internal fragmentation:** Không biết output bao dài nên phải cấp thừa
- **External fragmentation:** Các request khác nhau cần kích thước khác nhau, tạo khoảng trống giữa các block

**PagedAttention** (vLLM) giải quyết bằng cách mượn ý tưởng **paging** từ hệ điều hành:

1. KV cache chia thành **blocks** nhỏ (ví dụ 16 token/block)
2. Blocks cấp phát **non-contiguous** — không cần liền nhau trong VRAM
3. Block table theo dõi block nào thuộc request nào
4. Request xong → blocks giải phóng ngay cho request khác

**Kết quả:** GPU utilization từ ~24% lên **~98.5%**. Batch size có thể tăng **2–4×** trên cùng phần cứng.

### 6.3 Sliding Window Attention

Một số model (Mistral) dùng **sliding window**: chỉ giữ KV cache cho N token gần nhất (ví dụ 4096), token cũ hơn bị loại bỏ. Giới hạn KV cache ở mức cố định bất kể context dài bao nhiêu.

Trade-off: mất thông tin ở đầu context. Phù hợp cho chat (thông tin gần quan trọng hơn), không phù hợp cho document processing (cần toàn bộ context).

### 6.4 Token eviction / compression

Các kỹ thuật nâng cao xác định token nào "ít quan trọng" (attention score thấp) và loại bỏ khỏi cache:

- **StreamingLLM:** Giữ "attention sink" tokens (vài token đầu tiên) + N token gần nhất
- **H2O (Heavy-Hitter Oracle):** Giữ token có attention score tích lũy cao nhất
- **Dynamic Memory Compression:** Nén groups of tokens thành representation nhỏ hơn

Các kỹ thuật này cho phép context "hiệu dụng" dài hơn physical KV cache.

---

## 7. Prefill vs Decode — hai pha khác nhau hoàn toàn

Hiểu 2 pha này giúp hiểu tại sao KV cache quan trọng:

### Prefill (xử lý input)

- Toàn bộ input tokens xử lý **parallel** (cùng lúc)
- Phép tính: matrix × matrix → **compute-bound** (GPU tính toán là bottleneck)
- KV cache được tạo cho toàn bộ input tokens
- Tốc độ đo bằng: **tokens processed per second** (TTFT — Time To First Token)

### Decode (sinh output)

- Sinh **1 token/bước**, tuần tự
- Phép tính: matrix × vector → **memory-bound** (đọc bộ nhớ là bottleneck)
- Mỗi bước: đọc toàn bộ weights + KV cache từ VRAM, chỉ tính cho 1 token
- Tốc độ đo bằng: **tokens generated per second** (TPS)

### Tại sao decode bị memory-bound?

```
Tổng data cần đọc mỗi decode step:
= Model weights + KV cache
= 37 GB (70B INT4) + 10.2 GB (1 user, 32K, BF16)
= 47.2 GB

Trên H100 (3.350 GB/s bandwidth):
Max tokens/sec = 3.350 / 47.2 ≈ 71 token/s (lý thuyết)
```

GPU H100 có 990 TFLOPS nhưng chỉ cần ~1 GFLOP cho 1 token decode. Compute utilization <0.1%. **100% bottleneck là đọc bộ nhớ.**

Đây là lý do:
- **Bandwidth quan trọng hơn TFLOPS** cho inference
- **Quantize weights + KV cache** trực tiếp tăng tốc (ít data cần đọc)
- **Batch > 1** hiệu quả vì weights chỉ đọc 1 lần cho cả batch

---

## 8. KV Cache với MoE — đặc thù riêng

Model MoE (Kimi K2.6, DeepSeek V4, GLM-5.1) có đặc điểm:

- Attention layers vẫn dùng KV cache **bình thường** (giống dense model)
- Expert layers (MLP) **không tạo KV cache** — chỉ attention layer mới có
- Nhưng toàn bộ expert weights phải nằm trong VRAM (vì bất kỳ token nào cũng có thể route đến bất kỳ expert nào)

**Hệ quả:** Với MoE, KV cache chiếm tỷ lệ nhỏ hơn tổng VRAM (vì weights lớn hơn nhiều), nhưng vẫn là yếu tố scaling quan trọng khi tăng users/context.

Ví dụ Kimi K2.6 (1T params, 61 layers):
- Weights INT4: ~500 GB (chiếm đa số VRAM)
- KV cache 1 user 128K (BF16): ~20–30 GB (ước tính, phụ thuộc MLA config)
- KV cache 10 user 128K: ~200–300 GB

Tổng cho 10 user: ~700–800 GB → cần 8× H100 hoặc 4–6× H200.

---

## 9. Batching — KV cache và multi-user serving

### Static batching: lãng phí

Gom N request thành 1 batch, chờ **tất cả** xong. Request A sinh 10 token, request B sinh 500 → A phải chờ B → GPU lãng phí 490 bước cho A.

### Continuous batching (in-flight batching): hiệu quả

Khi request A xong → lập tức đưa request C vào slot trống, B vẫn chạy. GPU luôn bận. **KV cache của A được giải phóng ngay** cho C dùng.

vLLM kết hợp PagedAttention + continuous batching:
- PagedAttention: cấp phát KV cache hiệu quả
- Continuous batching: tái sử dụng slot ngay khi request xong
- Prefix caching: nếu nhiều request có chung prefix (system prompt), cache prefix chỉ lưu **1 lần**

### Prefix caching — tiết kiệm lớn cho production

Nhiều request chia sẻ cùng system prompt (ví dụ 2.000 token). Không cần tính + lưu KV cache cho 2.000 token này mỗi request. Tính 1 lần, dùng chung:

```
Không có prefix caching:
  10 user × (2K system + 8K user) = 10 × 10K = 100K token cache

Có prefix caching:
  1 × 2K system (shared) + 10 × 8K user = 82K token cache
  Tiết kiệm: 18%
```

Với system prompt dài (RAG context 10K+ token), tiết kiệm lên tới 40–60%.

---

## 10. Speculative Decoding — KV cache cho 2 model

Speculative decoding dùng **model nhỏ** (draft) đoán trước N token, rồi **model lớn** (verifier) kiểm tra parallel. Mỗi model cần KV cache riêng:

```
Draft model (7B): KV cache nhỏ, sinh nhanh
Main model (70B): KV cache lớn, nhưng verify N token cùng lúc

Tổng KV cache = cache_draft + cache_main
```

Tuy tốn thêm VRAM cho draft model cache, speedup ~1.5–2.5× thường xứng đáng. Nhưng cần tính tổng VRAM cho cả 2 model khi planning.

---

## 11. Công cụ tính

### Python snippet

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

# Llama 3.3 70B, 10 user, 32K context, BF16
print(f"{kv_cache_gb(80, 8, 128, 32768, 10, 2):.1f} GB")
# → 97.5 GB

# Cùng config nhưng FP8 cache
print(f"{kv_cache_gb(80, 8, 128, 32768, 10, 1):.1f} GB")
# → 48.8 GB
```

### Online tools

- [LMCache KV Cache Calculator](https://lmcache.ai/kv_cache_calculator.html) — chọn model, chọn precision, nhập token count
- [LocalLLM VRAM Calculator](https://localllm.in/blog/interactive-vram-calculator) — tính tổng VRAM (weights + KV cache + overhead)

---

## 12. Cheat sheet — tra nhanh

### KV cache theo model (1 user, BF16)

| Model | Per token | 4K ctx | 32K ctx | 128K ctx |
|---|---|---|---|---|
| Llama 3.1 8B | 0.125 MB | 0.5 GB | 4 GB | **16 GB** |
| Phi-4 14B | 0.098 MB | 0.4 GB | 3.1 GB | 12.5 GB |
| Llama 3.3 70B | 0.31 MB | 1.3 GB | 10.2 GB | **40.6 GB** |
| Llama 4 Scout 109B | ~0.31 MB | 1.3 GB | 10 GB | 40 GB |

### Nhân hệ số cho multi-user

| Users | Nhân KV cache |
|---|---|
| 1 | ×1 |
| 5 | ×5 |
| 10 | ×10 |
| 20 | ×20 |

### Nhân hệ số cho precision

| Precision | Nhân KV cache |
|---|---|
| BF16 (baseline) | ×1 |
| FP8 | ×0.5 |
| Q4 | ×0.25 |

### Tổng VRAM nhanh

```
VRAM ≈ Weights(precision) + KV_cache(ctx × users × cache_precision) + 10–20% overhead
```

---

## 13. Sai lầm phổ biến

### "Model 8B chỉ cần 4 GB RAM (INT4)"

Đúng cho weights. Nhưng:
- Thêm 4 GB KV cache cho context 32K
- Thêm 1 GB overhead
- Tổng: ~9 GB — không vừa GPU 8GB nếu context dài

### "Tôi có H100 80GB, chạy được 70B INT4 cho 20 user"

- Weights INT4: 37 GB
- KV cache 20 user × 8K, BF16: 52 GB
- Tổng: 89 GB > 80 GB → **OOM**
- Fix: dùng FP8 KV cache → 26 GB → Tổng 65 GB → vừa

### "Context 10M token của Llama 4 Scout chạy trên 1× H100"

- Weights INT4: ~58 GB
- KV cache 1 user × 10M, BF16: **~3.100 GB** → Cần cluster ~40× H100
- Thực tế production: Scout giới hạn ở ~128K–256K context trên 1 GPU

### "MoE model chỉ cần VRAM cho active parameters"

Sai. Toàn bộ 1T tham số của Kimi K2.6 phải nằm trong VRAM, dù chỉ 32B active mỗi token. Expert không thể offload ra CPU rồi đưa vào theo nhu cầu — latency không chấp nhận được.

---

## 14. Tóm tắt

Năm điều cần nhớ về KV Cache:

1. **KV Cache là bộ nhớ tăng tuyến tính** theo context_length × batch_size. Ở context dài + nhiều user, nó lớn hơn model weights.

2. **GQA giảm cache 8×** so với MHA cổ điển mà chất lượng gần như giữ nguyên. Mọi model 2025-2026 đều dùng GQA hoặc MLA.

3. **Quantize KV cache (FP8)** là optimization có ROI cao nhất — giảm 50% cache, chất lượng ~99%, chỉ cần thêm 1 flag khi khởi động.

4. **PagedAttention (vLLM)** loại bỏ lãng phí bộ nhớ do cấp phát tĩnh, tăng throughput 2–4×.

5. **Luôn tính VRAM = Weights + KV Cache + Overhead.** Nếu chỉ tính weights, bạn sẽ deploy xong rồi OOM crash khi user thật bắt đầu dùng.

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

*Cập nhật: 07/05/2026.*
