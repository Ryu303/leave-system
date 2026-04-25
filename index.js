const functions = require("firebase-functions");
const axios = require("axios"); // npm install axios 필요

// 프론트엔드에서 호출할 수 있는 Callable Function
exports.getKakaoRoute = functions.region('asia-northeast3').https.onCall(async (data, context) => {
    // 1. 보안: 로그인한 사용자만 API를 호출할 수 있도록 백엔드에서 차단
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', '인증된 사용자만 이용할 수 있습니다.');
    }

    const { origin, destination } = data;
    if (!origin || !destination) {
        throw new functions.https.HttpsError('invalid-argument', '출발지와 도착지 좌표가 필요합니다.');
    }

    // 🔥 핵심 수정 1: 평문 키값 삭제 (무조건 환경변수에서만 가져오도록)
    const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY; 
    
    // 🔥 핵심 수정 2: URL 템플릿 리터럴에 포함된 잘못된 꺾쇠 < > 제거
    const url = `https://apis-navi.kakaomobility.com/v1/directions?origin=${origin.lng},${origin.lat}&destination=${destination.lng},${destination.lat}`;

    try {
        const response = await axios.get(url, {
            headers: { 'Authorization': `KakaoAK ${KAKAO_REST_API_KEY}` }
        });
        
        // 성공적으로 받은 데이터를 프론트엔드로 그대로 전달
        return response.data;
    } catch (error) {
        console.error("Kakao API Error:", error.response ? error.response.data : error.message);
        // 프론트엔드에는 구체적인 에러 원인을 숨기고 일반적인 메시지만 전달하여 추가적인 보안 확보
        throw new functions.https.HttpsError('internal', '경로를 가져오는 중 서버 오류가 발생했습니다.');
    }
});