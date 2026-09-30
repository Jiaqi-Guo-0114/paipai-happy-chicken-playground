# 第三方语音生成说明

游戏中的中文 WAV 提示语由本地文本转语音模型生成，游戏运行时不加载模型，也不访问网络。

- 模型：Qwen3-TTS-12Hz-1.7B-CustomVoice（8-bit MLX 量化，Apache License 2.0）
- Apple Silicon 推理实现：`Blaizzy/mlx-audio`（MIT License）
- 中文音色：`Serena`
- 输出：24 kHz、单声道、16-bit PCM WAV

项目内只包含生成后的音频。模型权重保存在本机 Hugging Face 缓存中，不属于离线游戏安装包。

来源：

- https://github.com/QwenLM/Qwen3-TTS
- https://github.com/Blaizzy/mlx-audio
- https://huggingface.co/mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-8bit
