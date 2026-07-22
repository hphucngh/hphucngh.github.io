---
layout: note
title: Debug là quá trình tư duy, không phải tìm bug
date: 2026-03-15
description: Khi bạn không hiểu tại sao code chạy đúng, bạn cũng không hiểu tại sao nó sai.
tags:
  - engineering
---

Lần nào tôi debug mà không hiểu hệ thống, tôi đều tốn gấp đôi thời gian.

Điều này liên quan trực tiếp tới [[writing-clarifies-thinking]] — viết ra giả thuyết chính là cách debug tốt nhất.

Quy trình tôi đang dùng:
1. Viết ra giả thuyết trước khi chạy bất kỳ lệnh nào
2. Mỗi lệnh là một thí nghiệm xác nhận hoặc bác bỏ giả thuyết đó
3. Nếu không có giả thuyết → dừng lại, đọc thêm

"Thử xem sao" là cái bẫy tốn thời gian nhất trong lập trình.

Và giống như [[simplicity-is-hard]], giải pháp debug tốt nhất thường là hiểu vấn đề sâu hơn, không phải thêm log.
