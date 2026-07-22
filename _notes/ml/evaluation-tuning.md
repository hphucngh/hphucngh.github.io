---
layout: note
title: Đánh giá, Tinh chỉnh & Điều chuẩn Mô hình
date: 2026-05-13
description: Metrics, overfitting, regularization, hyperparameter tuning và các phương pháp đánh giá mô hình ML.
tags: [ml, evaluation]
---

| Thuật ngữ (Anh / Việt)                                    | Định nghĩa tóm tắt                                                                                                                                                  |
| :--------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Train/Validation/Test Set**                              | Các phần của dữ liệu: Tập huấn luyện (học), Tập xác thực (tinh chỉnh/chọn mô hình), và Tập kiểm thử (đánh giá cuối cùng).                                          |
| **Overfitting (Quá khớp)**                                | Mô hình ghi nhớ quá sát dữ liệu huấn luyện (bao gồm cả nhiễu) nhưng lại dự đoán sai trên dữ liệu mới.                                                              |
| **Underfitting (Chưa phù hợp)**                           | Mô hình quá đơn giản, không đủ sức mạnh để học được cấu trúc của dữ liệu huấn luyện.                                                                                 |
| **Accuracy / Precision / Recall**                          | **Accuracy:** Tỷ lệ đoán đúng tổng thể. **Precision:** Tỷ lệ đúng trên tổng dự đoán dương. **Recall:** Tỷ lệ phát hiện được trong tổng số ca dương tính thực.        |
| **Confusion Matrix (Ma trận nhầm lẫn)**                   | Bảng gồm 4 ô (TP, FP, TN, FN) giúp hình dung chi tiết kết quả đúng/sai của mô hình phân loại nhị phân.                                                              |
| **ROC & AUC**                                              | Biểu đồ (ROC) và diện tích dưới đường cong (AUC) so sánh tỷ lệ dương tính thật và dương tính giả ở mọi ngưỡng phân loại.                                             |
| **MSE & MAE**                                              | Chỉ số đo lường độ lỗi cho mô hình hồi quy. (MSE: Sai số bình phương trung bình; MAE: Sai số tuyệt đối trung bình).                                                 |
| **Regularization (Điều chuẩn L1, L2)**                    | Cách thêm hình phạt đối với độ phức tạp của mô hình vào hàm tổn thất (đẩy trọng số về 0) để ngăn chặn overfitting.                                                   |
| **Learning Rate (Tốc độ học)**                             | Siêu tham số điều khiển mức thay đổi lớn hay nhỏ của trọng số trong mỗi bước cập nhật của thuật toán giảm độ dốc.                                                     |
| **Epoch / Batch Size**                                     | **Epoch:** Một vòng lặp qua toàn bộ dữ liệu huấn luyện. **Batch size:** Số ví dụ lấy ra tính toán trước khi cập nhật trọng số.                                       |

---

Xem thêm: [[production-responsible-ai]]
