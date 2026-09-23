// 플러그인 목록. 새 기능은 이 폴더에 모듈을 만들고 여기에 추가하세요.
//
// 플러그인 형식:
//   export default {
//     id: 'my-plugin',
//     name: '내 플러그인',
//     setup(api) {
//       api.addAction({ label: '버튼', icon: '★', needsDevice: true, onClick: (api) => { ... } });
//       api.addMenuItem({ label: '메뉴 항목', onClick: (api) => { ... } });
//       api.addTemplate('pico', { id: 'x', title: '예제', desc: '설명', code: '...' });
//       api.addCompletionSource((ctx, board) => null);   // CodeMirror 자동완성 소스
//       api.on('connect' | 'disconnect' | 'run' | 'fileopen', (arg) => { ... });
//       // api.exec(code) 로 장치에서 코드를 실행하고 출력을 문자열로 받을 수 있습니다.
//     },
//   };
import deviceInfo from './device-info.js';

export default [deviceInfo];
