// 예제 플러그인: 연결된 장치의 메모리 / 저장공간 정보를 터미널에 표시
export default {
  id: 'device-info',
  name: '장치 정보',
  setup(api) {
    api.addMenuItem({
      label: 'ℹ 장치 정보 (메모리/저장공간)',
      async onClick(api) {
        if (!api.device) { api.toast('먼저 장치를 연결하세요'); return; }
        try {
          const out = await api.exec(
`import gc, sys
gc.collect()
print("플랫폼:", sys.platform)
print("버전:", sys.version)
print("여유 RAM:", gc.mem_free(), "bytes")
try:
    import os
    s = os.statvfs("/")
    print("저장공간: 여유 {} / 전체 {} KB".format(s[0]*s[3]//1024, s[0]*s[2]//1024))
except Exception:
    pass
`);
          api.terminal.write('\r\n' + out.replace(/\r?\n/g, '\r\n'), 'info');
          api.setView('terminal');
        } catch (e) {
          api.toast('정보를 읽지 못했습니다: ' + e.message, 'error');
        }
      },
    });
  },
};
