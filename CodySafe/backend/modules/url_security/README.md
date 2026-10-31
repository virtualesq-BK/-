# CodySafe — URL Security Detection Module

독립형 URL 보안 분석 REST API 모듈입니다.  
피싱, 타이포스쿼팅, 브랜드 사칭, 악성 리다이렉션, Threat Intelligence 연계를 규칙 기반으로 분석합니다.

---

## 빠른 시작

```bash
# 1. 가상환경 생성 및 의존성 설치
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt

# 2. 환경변수 설정 (선택)
copy .env.example .env
# .env 파일에 API Key 입력

# 3. 서버 실행 (프로젝트 루트)
uvicorn main:app --reload

# 4. Swagger UI 접속
# http://localhost:8000/docs
```

---

## Docker 실행

```bash
docker build -t codysafe-url-security .
docker run -p 8000:8000 --env-file .env codysafe-url-security
```

---

## API

### POST /api/v1/url-security/analyze

URL 보안 분석을 수행합니다.

**요청 예시**

```json
{
  "url": "https://paypa1.com/login",
  "options": {
    "check_redirects": true,
    "check_dns": true,
    "check_ssl": true,
    "check_threat_intelligence": true
  }
}
```

**응답 필드**

| 필드 | 설명 |
|---|---|
| `risk_score` | 0~100 위험 지수 (확률 아님) |
| `risk_level` | LOW / MEDIUM / HIGH / CRITICAL |
| `verdict` | SAFE / SUSPICIOUS / MALICIOUS |
| `indicators` | 탐지된 위험 요소 목록 |
| `domain_intelligence` | DNS, SSL 분석 결과 |
| `redirect_analysis` | 리다이렉션 체인 |
| `threat_intelligence` | 외부 TI 서비스 결과 |
| `evidence` | 탐지 근거 설명 |
| `recommendations` | 대응 가이드 |
| `score_breakdown` | 엔진별 점수 기여 |

### GET /api/v1/url-security/health

모듈 상태 및 외부 서비스 연결 상태 반환.

---

## 분석 엔진

| 엔진 | 설명 |
|---|---|
| URL Structure | IP 직접 사용, 긴 URL, @ 기호, 비표준 포트 등 |
| Domain Intelligence | DNS A/MX/NS, SSL/TLS 인증서 유효성 |
| Typosquatting | 브랜드 사칭, 유사 도메인, Punycode, Homograph |
| Redirect | HTTP 리다이렉션 체인, URL 단축 서비스 |
| Threat Intelligence | Google Safe Browsing, VirusTotal, URLhaus, PhishTank |
| Risk Engine | 통합 위험 점수 산출 및 권고 |

---

## 환경변수

| 변수 | 설명 | 필수 |
|---|---|---|
| `GOOGLE_SAFE_BROWSING_KEY` | Google Safe Browsing API Key | 선택 |
| `VIRUSTOTAL_KEY` | VirusTotal API Key | 선택 |
| `PHISHTANK_KEY` | PhishTank API Key | 선택 |
| `URLHAUS_KEY` | URLhaus (공개 API; 불필요) | 불필요 |

API Key가 없으면 해당 서비스는 `not_configured` 상태를 반환하며, 규칙 기반 엔진은 계속 작동합니다.

---

## 테스트 실행

```bash
pytest -v
```

---

## 외부 서비스 라이선스 및 이용약관

| 서비스 | 라이선스 / 이용약관 | 상업적 이용 |
|---|---|---|
| Google Safe Browsing | [Terms of Service](https://developers.google.com/safe-browsing/terms) | 별도 확인 필요 |
| VirusTotal | [Terms of Service](https://www.virustotal.com/gui/terms-of-service) | 무료 플랜 상업적 이용 제한 있음 |
| URLhaus (abuse.ch) | [API Docs](https://urlhaus-api.abuse.ch/) | 비상업적 및 보안 연구 목적으로 무료 |
| PhishTank | [Terms of Service](https://www.phishtank.com/terms.php) | API Key 등록 필요; 상업적 이용 별도 확인 |

**상업적 서비스에 통합하기 전에 각 서비스의 최신 이용약관을 반드시 확인하십시오.**

---

## 보안 설계

- **SSRF 방어**: 모든 외부 HTTP 요청 전 SSRF Guard가 호스트 검증
- **Private/Loopback/Cloud Metadata IP 차단**: 10.x, 172.16.x, 192.168.x, 127.x, 169.254.169.254 등 모두 차단
- **DNS Rebinding 방어**: DNS 해석 후 IP 재검증
- **Rate Limiting**: 분당 60회 기본 제한 (slowapi)
- **응답 크기 제한**: 512 KB 기본값
- **연결 타임아웃**: connect 5s, read 10s
- **실제 페이지 실행 없음**: HTTP HEAD 요청으로만 리다이렉션 추적

---

## 구현 한계 (MVP)

1. **WHOIS 조회 미구현**: 도메인 연령/등록기관 정보는 `unavailable`로 반환
2. **JS/Meta Refresh 리다이렉션 미분석**: HTTP 헤더 기반 리다이렉션만 추적
3. **AI 모델 미사용**: 규칙 기반 엔진만 사용 (`engine: rule_based`)
4. **scikit-learn ML 분류기 미포함**: 벡터 분석은 향후 확장 가능
5. **페이지 콘텐츠 분석 없음**: HTML 본문의 폼, 자격증명 요청 패턴 미탐지
6. **외부 TI API 연결 시 실제 네트워크 필요**: 미설정 시 `not_configured` 반환
