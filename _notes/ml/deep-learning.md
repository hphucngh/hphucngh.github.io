---
layout: note
title: Học sâu & Mạng Nơ-ron
date: 2026-05-13
description: Neural Networks, CNN, RNN, Transformer, LLM, GAN và các khái niệm deep learning cốt lõi.
tags: [ml, deep-learning]
---

| Thuật ngữ (Anh / Việt)                                   | Định nghĩa tóm tắt                                                                                                                           |
| :-------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| **Neural Network (Mạng nơ-ron)**                         | Mô hình chứa lớp đầu vào, một/nhiều lớp ẩn (nút/nơ-ron) và lớp đầu ra, chuyên dùng để tìm hiểu các hàm phi tuyến tính.                      |
| **Activation Function (Hàm kích hoạt)**                  | Hàm toán học (như ReLU, Sigmoid) áp dụng cho đầu ra của nơ-ron để cho phép mạng học các mối quan hệ phi tuyến tính.                            |
| **Backpropagation (Lan truyền ngược)**                   | Quá trình tính toán đạo hàm của sai số ngược từ đầu ra về đầu vào để mạng nơ-ron biết cách điều chỉnh trọng số.                               |
| **Gradient Descent (Giảm độ dốc)**                      | Thuật toán tối ưu hoá lặp đi lặp lại việc tinh chỉnh trọng số đi ngược hướng đạo hàm để giảm thiểu tổn thất.                                 |
| **CNN (Mạng nơ-ron tích chập)**                          | Mạng học sâu đặc biệt hiệu quả trong xử lý hình ảnh nhờ các lớp tích chập nhận diện đặc trưng không gian.                                    |
| **RNN (Mạng nơ-ron hồi quy)**                           | Mạng học sâu có bộ nhớ (duy trì trạng thái ẩn) qua các bước thời gian, dùng để xử lý dữ liệu chuỗi (văn bản, chuỗi thời gian).              |
| **Transformer**                                           | Kiến trúc mạng nơ-ron dựa vào **cơ chế tự chú ý (self-attention)** để phân tích mức độ liên quan của mọi mã thông báo cùng lúc.               |
| **LLM (Mô hình ngôn ngữ lớn)**                          | Mô hình Transformer khổng lồ chứa hàng tỷ tham số, có khả năng dự đoán và tạo văn bản tự nhiên.                                               |
| **GAN (Mạng đối nghịch tạo sinh)**                      | Hệ thống gồm một bộ tạo (tạo dữ liệu giả) và một bộ phân biệt (cố gắng phát hiện giả mạo) huấn luyện đối kháng nhau để tạo ra nội dung mới. |

---

Xem thêm: [[evaluation-tuning]]
