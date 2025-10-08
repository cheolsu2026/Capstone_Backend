const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

class S3Service {
  constructor() {
    this.s3 = new S3Client({
      region: process.env.AWS_REGION || 'ap-northeast-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
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
        ContentType: contentType,
      };

      await this.s3.send(new PutObjectCommand(uploadParams));

      // v3에서는 반환값이 Location을 자동으로 주지 않기 때문에 직접 생성
      const imageUrl = `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

      return {
        success: true,
        imageUrl,
        key,
      };
    } catch (error) {
      console.error('S3 업로드 오류:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = new S3Service();