# MPython Web IDE

스마트폰(또는 PC) 브라우저에서 **Raspberry Pi Pico / micro:bit** 를 MicroPython 으로 코딩하고,
USB 시리얼로 연결된 보드에 바로 실행·다운로드하는 웹앱입니다.

👉 **https://samcho93.github.io/mpython/**

## 기능
- **파이썬 에디터** (CodeMirror 6): 문법 강조, 자동 들여쓰기, 괄호 짝 맞춤, 코드 접기, 찾기/바꾸기, 실행 취소,
  주석 토글, 보드별 API 자동완성(`machine.`, `display.`, 변수 타입 추정 등), 간단한 문법 검사
- **모바일 보조 키바**: Tab / 괄호 / 기호 / 커서 이동 버튼
- **보드 자동 인식**: Pico, Pico W, Pico 2, Pico 2 W, micro:bit V1/V2, 기타 MicroPython 장치
- **새로 만들기**: 연결된 보드에 맞는 라이브러리를 import 하는 예제 (LED, PWM, ADC, 온도, 인터럽트, 타이머, 서보, I2C, NeoPixel, PIO, 듀얼코어, Wi-Fi / 디스플레이, 버튼, 가속도, 나침반, 음악, 라디오, 마이크 등)
- **실행(▶)**: 저장하지 않고 raw REPL 로 즉시 실행, 출력 실시간 표시 / **정지(■)**
- **다운로드(⬇)**: 장치에 `main.py` 로 저장 후 리셋 → 전원만 켜도 자동 실행
- **장치 파일 관리**: 목록, 열기, 삭제
- **터미널(REPL)**: 명령 입력, 기록, Ctrl-C, 소프트 리셋
- 브라우저에 파일 자동 저장, .py 가져오기/내보내기, 다크 모드, PWA(오프라인)

## 사용 환경
| 환경 | 연결 방식 |
|---|---|
| Android Chrome | WebUSB (USB OTG 케이블) — 기본 / Web Serial |
| PC Chrome, Edge | Web Serial |
| iPhone / iPad | USB 미지원 (편집만 가능) |

## 구조
```
index.html            화면
css/style.css         스타일 (모바일 우선, 900px 이상 3단 레이아웃)
js/app.js             UI 및 동작, 플러그인 API (window.MPY)
js/editor.js          CodeMirror 에디터, 자동완성, 린트
js/terminal.js        터미널 에뮬레이터
js/transport.js       Web Serial / WebUSB(CDC-ACM) 전송
js/repl.js            MicroPython raw REPL 프로토콜 (실행, 파일 읽기/쓰기)
js/boards.js          보드 정의, API 목록, 예제 템플릿
js/plugins/           확장 기능
vendor/codemirror.js  CodeMirror 6 번들 (빌드 없이 동작)
```

## 기능 확장 (플러그인)
`js/plugins/` 에 모듈을 만들고 `js/plugins/index.js` 에 추가합니다.

```js
export default {
  id: 'my-plugin',
  setup(api) {
    api.addAction({ label: '정보', icon: 'ℹ', needsDevice: true, onClick: async (api) => {
      api.terminal.write(await api.exec('import gc\nprint(gc.mem_free())\n'));
    }});
    api.addTemplate('pico', { id: 'demo', title: '내 예제', desc: '설명', code: 'print("hi")\n' });
    api.on('connect', (device) => console.log(device.board));
  },
};
```
API: `addAction`, `addMenuItem`, `addTemplate`, `registerBoard`, `addCompletionSource`, `on(event)`,
`exec(code)`, `run()`, `stop()`, `upload()`, `newFile()`, `editor`, `terminal`, `device`, `toast()`.

## 로컬 실행
ES 모듈을 사용하므로 정적 서버로 여세요: `npx http-server -p 5173` → http://localhost:5173
(Web Serial / WebUSB 는 HTTPS 또는 localhost 에서만 동작합니다)
