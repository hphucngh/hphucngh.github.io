---
layout: note
title: Sản xuất & Trí tuệ Nhân tạo Trách nhiệm
date: 2026-05-13
description: Inference, training-serving skew, fairness, bias và các vấn đề khi đưa ML vào production.
tags: [ml, production, responsible-ai]
---

| Thuật ngữ (Anh / Việt)                                    | Định nghĩa tóm tắt                                                                                                                                                   |
| :--------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Static vs Dynamic Inference**                            | **Tĩnh (Ngoại tuyến):** Tính toán và lưu trước dự đoán vào bộ nhớ đệm. **Động (Trực tuyến):** Dự đoán ngay lập tức theo yêu cầu (real-time).                         |
| **Training-serving Skew**                                  | Lỗi xảy ra khi dữ liệu lúc huấn luyện và dữ liệu lúc phân phát thực tế bị lệch hoặc không cùng định dạng.                                                           |
| **Label Leakage (Rò rỉ nhãn)**                            | Sai lầm khi các thông tin mang bản chất của nhãn mục tiêu vô tình bị lọt vào các đặc trưng dùng để huấn luyện mô hình.                                                |
| **Fairness (Tính công bằng)**                              | Đảm bảo mô hình AI không mang thành kiến hoặc tạo ra kết quả bất lợi cho các nhóm người dùng nhạy cảm (chủng tộc, giới tính, v.v.).                                   |
| **Demographic Parity**                                     | Thước đo công bằng đảm bảo tỷ lệ một nhãn cụ thể (như "được chấp nhận") là ngang nhau ở tất cả các nhóm nhân khẩu học.                                                |
| **Equality of Opportunity**                                | Thước đo công bằng yêu cầu mô hình dự đoán nhãn dương tính với tỷ lệ thành công (tỷ lệ dương tính thật) bằng nhau cho mọi nhóm.                                      |
| **Counterfactual Fairness**                                | Tính công bằng phản thực tế: mô hình phải cho ra cùng một dự đoán nếu ta thay đổi đặc điểm nhạy cảm của ví dụ mà giữ nguyên mọi thứ khác.                             |
| **Bias (Thiên kiến)**                                      | Các lỗi hoặc định kiến của con người (thiên kiến xác nhận, thiên kiến lấy mẫu, v.v.) vô tình được đưa vào dữ liệu hoặc thiết kế mô hình.                              |

---

Xem thêm: [[ai-is-a-multiplier]]
