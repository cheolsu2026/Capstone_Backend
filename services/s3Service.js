const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

class S3Service {
    constructor() {
        this.s3 = new AWS.S3({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION || 'ap-northeast-2'
        });
        this.bucketName = process.env.S3_BUCKET_NAME;
    }

    // 이미지 버퍼를 S3에 업로드
    async uploadImage(imageBuffer, contentType = 'image/png') {
        try {
            const key = `game/${uuidv4()}.png`;
            
            const uploadParams = {
                Bucket: this.bucketName,
                Key: key,
                Body: imageBuffer,
                ContentType: contentType
            };

            const result = await this.s3.upload(uploadParams).promise();
            
            return {
                success: true,
                imageUrl: result.Location,
                key: key
            };
        } catch (error) {
            console.error('S3 업로드 오류:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new S3Service();