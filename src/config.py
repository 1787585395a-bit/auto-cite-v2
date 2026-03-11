"""
配置模块 - 阿里云百炼API版本
"""
import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 禁用代理（必须在导入dashscope之前设置）
os.environ['HTTP_PROXY'] = ''
os.environ['HTTPS_PROXY'] = ''
os.environ['http_proxy'] = ''
os.environ['https_proxy'] = ''
os.environ['NO_PROXY'] = '*'

import dashscope

class Config:
    """全局配置类"""

    # API配置
    API_KEY = os.getenv("DASHSCOPE_API_KEY")

    # 模型配置
    MODEL_NAME = "qwen-plus"  # 阿里云通义千问模型

    # 生成参数配置
    GENERATION_CONFIG = {
        'temperature': 0.1,   # 低温度提高输出稳定性
        'max_tokens': 4096,   # 每批10个脚注输出约3000 tokens，4096安全
        'top_p': 0.95,
        'result_format': 'message'
    }

    # 文档处理参数
    MAX_CONTEXT_LENGTH = 100000
    CHUNK_SIZE = 50000

    # API调用参数
    MAX_RETRIES = 3
    RETRY_DELAY = 2
    RATE_LIMIT_DELAY = 1

    def __init__(self):
        """初始化配置"""
        if not self.API_KEY:
            raise ValueError(
                "DASHSCOPE_API_KEY未设置！\n"
                "请在.env文件中添加: DASHSCOPE_API_KEY=your-api-key-here"
            )

        # 配置阿里云API
        dashscope.api_key = self.API_KEY

        print("阿里云百炼API已配置")
        print(f"使用模型: {self.MODEL_NAME}")

# 创建全局配置实例
config = Config()
