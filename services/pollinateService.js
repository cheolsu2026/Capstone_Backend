const axios = require('axios');

class PollinateService {
    constructor() {
        this.baseURL = 'https://image.pollinations.ai/prompt/';
        this.imageWidth = 512;
        this.imageHeight = 512;
    }

    // 실제 이미지 요청 수행 (재시도 로직 없음)
    async _makeImageRequest(tags) {
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
            timeout: 60000, // 60초 타임아웃 (이미지 생성에 시간이 걸릴 수 있음)
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'image/png,image/jpeg,image/*,*/*'
            },
            validateStatus: function (status) {
                return status === 200;
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
        }
        
        throw new Error(`HTTP Error: ${response.status}`);
    }

    // 태그 리스트로 이미지 생성 요청 (재시도 로직 포함)
    async generateImage(tags) {
        try {
            return await this._makeImageRequest(tags);
        } catch (error) {
            console.error('Pollinations.ai API 오류:', error.message);
            
            // 상세 에러 정보 로깅
            if (error.response) {
                console.error(`HTTP Status: ${error.response.status}`);
                console.error(`Status Text: ${error.response.statusText}`);
            }
            if (error.code) {
                console.error(`Error Code: ${error.code}`);
            }
            
            // 500, 503 HTTP 에러나 네트워크 오류인 경우 재시도
            const shouldRetry = 
                error.response?.status === 500 || 
                error.response?.status === 503 ||
                error.code === 'ECONNABORTED' || 
                error.code === 'ENOTFOUND' ||
                error.code === 'ETIMEDOUT';
            
            if (shouldRetry) {
                console.log(`재시도 가능한 오류 (${error.response?.status || error.code}). 재시도...`);
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

    // 재시도 로직 (최대 3번)
    async retryGenerateImage(tags, retryCount) {
        if (retryCount > 3) {
            return {
                success: false,
                error: '최대 재시도 횟수 초과 (3회)'
            };
        }

        console.log(`재시도 ${retryCount}/3`);
        
        // 재시도 전 잠시 대기 (점진적 증가: 5초, 10초, 15초)
        const waitTime = 5000 * retryCount;
        console.log(`${waitTime/1000}초 대기 후 재시도...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        try {
            // 재시도 시에는 _makeImageRequest를 직접 호출하여 무한 재귀 방지
            return await this._makeImageRequest(tags);
        } catch (error) {
            // 상세 에러 정보 로깅
            if (error.response) {
                console.error(`재시도 ${retryCount} 실패 - HTTP Status: ${error.response.status}`);
                console.error(`Status Text: ${error.response.statusText}`);
            }
            if (error.code) {
                console.error(`Error Code: ${error.code}`);
            }
            
            // 재시도 가능한 에러면 계속 재시도
            const shouldRetry = 
                error.response?.status === 500 || 
                error.response?.status === 503 ||
                error.code === 'ECONNABORTED' || 
                error.code === 'ENOTFOUND' ||
                error.code === 'ETIMEDOUT';
            
            if (shouldRetry) {
                return await this.retryGenerateImage(tags, retryCount + 1);
            }
            
            // 재시도 불가능한 에러면 즉시 실패 반환
            return {
                success: false,
                error: `재시도 중 오류 발생: ${error.message}`,
                details: {
                    code: error.code,
                    status: error.response?.status,
                    statusText: error.response?.statusText
                }
            };
        }
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