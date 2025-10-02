const axios = require('axios');

class PollinateService {
    constructor() {
        this.baseURL = 'https://image.pollinations.ai/prompt/';
        this.imageWidth = 512;
        this.imageHeight = 512;
    }

    // 태그 리스트로 이미지 생성 요청
    async generateImage(tags) {
        try {
            // 태그들을 프롬프트로 변환
            const prompt = this.createPromptFromTags(tags);
            
            // URL 인코딩된 프롬프트로 이미지 생성 URL 생성
            const encodedPrompt = encodeURIComponent(prompt);
            const seed = Math.floor(Math.random() * 10000) + 1;
            const imageUrl = `${this.baseURL}${encodedPrompt}?width=${this.imageWidth}&height=${this.imageHeight}&seed=${seed}`;

            console.log(`이미지 생성 요청: ${prompt}`);
            console.log(`요청 URL: ${imageUrl}`);

            // 이미지 다운로드
            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                timeout: 30000, // 30초 타임아웃 (이미지 생성에 시간이 걸릴 수 있음)
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (response.status === 200 && response.data) {
                console.log(`이미지 생성 완료: ${response.data.length} bytes`);
                
                return {
                    success: true,
                    imageBuffer: Buffer.from(response.data),
                    contentType: response.headers['content-type'] || 'image/png',
                    imageUrl: imageUrl
                };
            } else {
                throw new Error(`HTTP Error: ${response.status}`);
            }

        } catch (error) {
            console.error('Pollinations.ai API 오류:', error.message);
            
            // 네트워크 오류인 경우 재시도 로직
            if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND') {
                console.log('네트워크 오류로 인한 재시도...');
                return await this.retryGenerateImage(tags, 1);
            }
            
            return {
                success: false,
                error: error.message,
                details: {
                    code: error.code,
                    status: error.response?.status,
                    statusText: error.response?.statusText
                }
            };
        }
    }

    // 재시도 로직 (최대 2번)
    async retryGenerateImage(tags, retryCount) {
        if (retryCount > 2) {
            return {
                success: false,
                error: '최대 재시도 횟수 초과'
            };
        }

        console.log(`재시도 ${retryCount}/2`);
        
        // 재시도 전 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
        
        return await this.generateImage(tags);
    }

    // 태그들을 프롬프트로 변환
    createPromptFromTags(tags) {
        if (!tags || tags.length === 0) {
            return "abstract art, colorful, creative";
        }
        
        // 태그들을 자연스러운 프롬프트로 변환
        const tagString = tags.join(', ');
        return `A creative and artistic image featuring: ${tagString}. High quality, detailed, vibrant colors, artistic style`;
    }

    // 이미지 URL 직접 생성 (디버깅용)
    generateImageUrl(tags) {
        const prompt = this.createPromptFromTags(tags);
        const encodedPrompt = encodeURIComponent(prompt);
        const seed = Math.floor(Math.random() * 10000) + 1;
        
        return `${this.baseURL}${encodedPrompt}?width=${this.imageWidth}&height=${this.imageHeight}&seed=${seed}`;
    }

    // 이미지 크기 설정
    setImageSize(width, height) {
        this.imageWidth = width;
        this.imageHeight = height;
    }
}

module.exports = new PollinateService();