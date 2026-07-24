// get the ninja-keys element
const ninja = document.querySelector('ninja-keys');

// add the home and posts menu items
ninja.data = [{
    id: "nav-about",
    title: "about",
    section: "Navigation",
    handler: () => {
      window.location.href = "/";
    },
  },{id: "nav-synthesis",
          title: "synthesis",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/synthesis/index.html";
          },
        },{id: "nav-notes",
          title: "notes",
          description: "Personal thoughts, reflections, and short notes.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/notes/";
          },
        },{id: "post-kv-cache-trong-production-tính-đúng-vram-trước-khi-bạn-oom",
        
          title: "KV Cache trong production: tính đúng VRAM trước khi bạn OOM",
        
        description: "Chắt lọc từ thực tế build &amp; ship LLM inference — vì sao KV Cache tồn tại, cách tính chính xác VRAM, những cần gạt đáng kéo trước, và các sai lầm khiến bạn OOM. Kèm số liệu Llama, DeepSeek, Kimi 2026.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/synthesis/2026/kv-cache-deep-dive/";
          
        },
      },{id: "post-tự-host-llm-hay-dùng-api-quyết-định-bằng-con-số",
        
          title: "Tự host LLM hay dùng API: quyết định bằng con số",
        
        description: "Chắt lọc từ thực tế build &amp; ship — vì sao 95% trường hợp nên dùng API, cách tính đúng VRAM và điểm hoà vốn, 5 lúc self-host thực sự đáng, và stack production nếu bạn quyết làm. Số liệu model &amp; giá 05/2026.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/synthesis/2026/self-hosted-llm-guide/";
          
        },
      },{id: "notes-viết-để-hiểu-không-phải-để-giải-thích",
          title: 'Viết để hiểu, không phải để giải thích',
          description: "Khi bạn không thể viết rõ ràng về một thứ, bạn chưa thực sự hiểu nó.",
          section: "Notes",handler: () => {
              window.location.href = "/notes/thinking/writing-clarifies-thinking/";
            },},{id: "notes-đơn-giản-khó-hơn-phức-tạp",
          title: 'Đơn giản khó hơn phức tạp',
          description: "Giải pháp đơn giản đòi hỏi hiểu biết sâu hơn, không phải nông hơn.",
          section: "Notes",handler: () => {
              window.location.href = "/notes/engineering/simplicity-is-hard/";
            },},{id: "notes-debug-là-quá-trình-tư-duy-không-phải-tìm-bug",
          title: 'Debug là quá trình tư duy, không phải tìm bug',
          description: "Khi bạn không hiểu tại sao code chạy đúng, bạn cũng không hiểu tại sao nó sai.",
          section: "Notes",handler: () => {
              window.location.href = "/notes/engineering/debugging-is-thinking/";
            },},{id: "notes-chi-phí-thực-của-context-switching",
          title: 'Chi phí thực của context switching',
          description: "Không phải thời gian chuyển task, mà là thời gian để lấy lại focus.",
          section: "Notes",handler: () => {
              window.location.href = "/notes/engineering/context-switching-cost/";
            },},{id: "notes-ai-là-bộ-khuếch-đại-không-phải-thay-thế",
          title: 'AI là bộ khuếch đại, không phải thay thế',
          description: "AI giỏi khuếch đại cả điểm mạnh lẫn điểm yếu của bạn.",
          section: "Notes",handler: () => {
              window.location.href = "/notes/thinking/ai-is-a-multiplier/";
            },},{id: "notes-xây-dựng-chậm-không-có-nghĩa-là-kém",
          title: 'Xây dựng chậm không có nghĩa là kém',
          description: "Tốc độ không phải lúc nào cũng là ưu tiên đúng.",
          section: "Notes",handler: () => {
              window.location.href = "/notes/thinking/on-building-slowly/";
            },},{id: "notes-ghi-chú-đầu-tiên",
          title: 'Ghi chú đầu tiên',
          description: "Suy nghĩ đầu tiên trên trang notes.",
          section: "Notes",handler: () => {
              window.location.href = "/notes/personal/first-note/";
            },},{id: "notes-thuật-toán-cổ-điển-trong-machine-learning",
          title: 'Thuật toán Cổ điển trong Machine Learning',
          description: "Linear/Logistic Regression, Decision Tree, Random Forest, Gradient Boosting, K-Means, SVM, PCA.",
          section: "Notes",handler: () => {
              window.location.href = "/notes/ml/classical-algorithms/";
            },},{id: "notes-dữ-liệu-amp-kỹ-thuật-đặc-trưng",
          title: 'Dữ liệu &amp;amp; Kỹ thuật Đặc trưng',
          description: "Feature engineering, encoding, normalization và các kỹ thuật xử lý dữ liệu cho ML.",
          section: "Notes",handler: () => {
              window.location.href = "/notes/ml/data-feature-engineering/";
            },},{id: "notes-học-sâu-amp-mạng-nơ-ron",
          title: 'Học sâu &amp;amp; Mạng Nơ-ron',
          description: "Neural Networks, CNN, RNN, Transformer, LLM, GAN và các khái niệm deep learning cốt lõi.",
          section: "Notes",handler: () => {
              window.location.href = "/notes/ml/deep-learning/";
            },},{id: "notes-đánh-giá-tinh-chỉnh-amp-điều-chuẩn-mô-hình",
          title: 'Đánh giá, Tinh chỉnh &amp;amp; Điều chuẩn Mô hình',
          description: "Metrics, overfitting, regularization, hyperparameter tuning và các phương pháp đánh giá mô hình ML.",
          section: "Notes",handler: () => {
              window.location.href = "/notes/ml/evaluation-tuning/";
            },},{id: "notes-khái-niệm-cơ-bản-machine-learning",
          title: 'Khái niệm cơ bản Machine Learning',
          description: "Các thuật ngữ nền tảng của ML — supervised, unsupervised, reinforcement learning và các khái niệm cốt lõi.",
          section: "Notes",handler: () => {
              window.location.href = "/notes/ml/fundamentals/";
            },},{id: "notes-sản-xuất-amp-trí-tuệ-nhân-tạo-trách-nhiệm",
          title: 'Sản xuất &amp;amp; Trí tuệ Nhân tạo Trách nhiệm',
          description: "Inference, training-serving skew, fairness, bias và các vấn đề khi đưa ML vào production.",
          section: "Notes",handler: () => {
              window.location.href = "/notes/ml/production-responsible-ai/";
            },},{
        id: 'social-email',
        title: 'email',
        section: 'Socials',
        handler: () => {
          window.open("mailto:%68%70%68%75%63.%6E%67%68@%67%6D%61%69%6C.%63%6F%6D", "_blank");
        },
      },{
        id: 'social-telegram',
        title: 'telegram',
        section: 'Socials',
        handler: () => {
          window.open("https://telegram.me/phucsnh", "_blank");
        },
      },{
        id: 'social-github',
        title: 'GitHub',
        section: 'Socials',
        handler: () => {
          window.open("https://github.com/hphucngh", "_blank");
        },
      },{
        id: 'social-custom_social',
        title: 'Custom_social',
        section: 'Socials',
        handler: () => {
          window.open("/cv/", "_blank");
        },
      },{
      id: 'light-theme',
      title: 'Change theme to light',
      description: 'Change the theme of the site to Light',
      section: 'Theme',
      handler: () => {
        setThemeSetting("light");
      },
    },
    {
      id: 'dark-theme',
      title: 'Change theme to dark',
      description: 'Change the theme of the site to Dark',
      section: 'Theme',
      handler: () => {
        setThemeSetting("dark");
      },
    },
    {
      id: 'system-theme',
      title: 'Use system default theme',
      description: 'Change the theme of the site to System Default',
      section: 'Theme',
      handler: () => {
        setThemeSetting("system");
      },
    },];
