---
layout: note
title: Dữ liệu & Kỹ thuật Đặc trưng
date: 2026-05-13
description: Feature engineering, encoding, normalization và các kỹ thuật xử lý dữ liệu cho ML.
tags: [ml, data-engineering]
---

| Thuật ngữ (Anh / Việt)                                   | Định nghĩa tóm tắt                                                                                                       |
| :-------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| **Feature (Đặc trưng)**                                  | Một biến đầu vào được mô hình sử dụng để đưa ra dự đoán.                                                                 |
| **Label (Nhãn)**                                          | Câu trả lời, kết quả thực tế hoặc "sự thật cơ bản" mà mô hình đang cố gắng dự đoán.                                     |
| **One-hot Encoding (Mã hoá One-hot)**                    | Kỹ thuật chuyển đổi một biến phân loại thành một vectơ nhị phân (chỉ có một số 1, còn lại là 0).                          |
| **Embeddings (Mục nhúng)**                                | Biểu diễn dữ liệu thưa thớt (như từ vựng) thành các vectơ liên tục, có số chiều thấp giúp mô hình học dễ hơn.            |
| **Feature Crosses (Giao nhau đặc trưng)**                | Kết hợp hai hay nhiều đặc trưng phân loại lại với nhau để giúp mô hình tuyến tính học được các mối quan hệ phi tuyến.     |
| **Normalization (Chuẩn hoá)**                             | Biến đổi các giá trị số khác dải đo về một phạm vi tiêu chuẩn (như điểm Z-score hoặc chia độ Min-Max).                    |
| **Binning / Bucketizing (Gộp nhóm)**                     | Chuyển đổi một đặc trưng số liên tục thành các đặc trưng phân loại bằng cách chia dữ liệu vào các khoảng (thùng).        |
| **Imbalanced Dataset (Tập dữ liệu mất cân bằng)**       | Tập dữ liệu mà trong đó một nhóm nhãn chiếm đa số áp đảo so với nhóm nhãn thiểu số còn lại.                              |

---

Xem thêm: [[evaluation-tuning]]
