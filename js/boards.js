// 보드 정의: 감지 규칙, 자동완성용 API 목록, 새로 만들기 예제
// 새 보드를 추가하려면 BOARDS 에 항목을 추가하거나 플러그인에서 registerBoard() 를 호출하세요.

const PICO_API = {
  modules: ['machine', 'time', 'utime', 'rp2', 'network', 'neopixel', '_thread', 'gc', 'os', 'sys',
    'math', 'random', 'struct', 'json', 'binascii', 'framebuf', 'micropython', 'asyncio',
    'onewire', 'ds18x20', 'dht', 'bluetooth', 'socket', 'requests', 'ntptime', 'select', 'array', 'collections'],
  members: {
    machine: ['Pin', 'PWM', 'ADC', 'I2C', 'SoftI2C', 'SPI', 'SoftSPI', 'UART', 'Timer', 'WDT', 'RTC',
      'freq', 'reset', 'soft_reset', 'unique_id', 'deepsleep', 'lightsleep', 'idle', 'disable_irq',
      'enable_irq', 'time_pulse_us', 'reset_cause', 'bootloader', 'mem8', 'mem16', 'mem32'],
    time: ['sleep', 'sleep_ms', 'sleep_us', 'ticks_ms', 'ticks_us', 'ticks_cpu', 'ticks_diff', 'ticks_add',
      'time', 'time_ns', 'localtime', 'gmtime', 'mktime'],
    rp2: ['PIO', 'StateMachine', 'asm_pio', 'bootsel_button', 'Flash', 'DMA'],
    network: ['WLAN', 'STA_IF', 'AP_IF', 'hostname', 'country'],
    neopixel: ['NeoPixel'],
    _thread: ['start_new_thread', 'allocate_lock', 'get_ident', 'exit'],
    gc: ['collect', 'mem_free', 'mem_alloc', 'enable', 'disable', 'threshold'],
    os: ['listdir', 'remove', 'rename', 'mkdir', 'rmdir', 'stat', 'statvfs', 'uname', 'getcwd', 'chdir', 'ilistdir'],
    sys: ['platform', 'implementation', 'version', 'path', 'modules', 'exit', 'stdin', 'stdout', 'print_exception'],
    micropython: ['const', 'mem_info', 'qstr_info', 'schedule', 'alloc_emergency_exception_buf', 'opt_level'],
    random: ['random', 'randint', 'randrange', 'choice', 'uniform', 'seed', 'getrandbits'],
    math: ['pi', 'e', 'sin', 'cos', 'tan', 'sqrt', 'pow', 'floor', 'ceil', 'fabs', 'log', 'exp', 'atan2', 'degrees', 'radians'],
  },
  classes: {
    Pin: ['OUT', 'IN', 'OPEN_DRAIN', 'ALT', 'PULL_UP', 'PULL_DOWN', 'IRQ_RISING', 'IRQ_FALLING',
      'value', 'on', 'off', 'toggle', 'high', 'low', 'irq', 'init'],
    PWM: ['freq', 'duty_u16', 'duty_ns', 'init', 'deinit'],
    ADC: ['read_u16', 'CORE_TEMP'],
    I2C: ['scan', 'readfrom', 'readfrom_into', 'writeto', 'readfrom_mem', 'readfrom_mem_into', 'writeto_mem', 'start', 'stop'],
    SoftI2C: ['scan', 'readfrom', 'readfrom_into', 'writeto', 'readfrom_mem', 'writeto_mem'],
    SPI: ['read', 'readinto', 'write', 'write_readinto', 'init', 'deinit', 'MSB', 'LSB'],
    UART: ['read', 'readline', 'readinto', 'write', 'any', 'init', 'deinit', 'flush', 'txdone'],
    Timer: ['init', 'deinit', 'PERIODIC', 'ONE_SHOT'],
    WDT: ['feed'],
    RTC: ['datetime'],
    WLAN: ['active', 'connect', 'disconnect', 'isconnected', 'ifconfig', 'scan', 'status', 'config'],
    NeoPixel: ['write', 'fill', 'n'],
    StateMachine: ['active', 'put', 'get', 'exec', 'irq', 'restart', 'rx_fifo', 'tx_fifo', 'init'],
  },
};

const MICROBIT_API = {
  modules: ['microbit', 'music', 'radio', 'speech', 'neopixel', 'random', 'math', 'utime', 'time', 'os',
    'gc', 'machine', 'audio', 'power', 'log', 'micropython', 'struct', 'array'],
  // from microbit import * 로 가져오는 이름들
  globals: ['display', 'button_a', 'button_b', 'accelerometer', 'compass', 'Image', 'sleep', 'running_time',
    'temperature', 'panic', 'reset', 'set_volume', 'speaker', 'microphone', 'Sound', 'SoundEvent', 'audio',
    'run_every', 'i2c', 'spi', 'uart', 'pin_logo', 'pin_speaker',
    'pin0', 'pin1', 'pin2', 'pin3', 'pin4', 'pin5', 'pin6', 'pin7', 'pin8', 'pin9', 'pin10',
    'pin11', 'pin12', 'pin13', 'pin14', 'pin15', 'pin16', 'pin19', 'pin20'],
  members: {
    display: ['show', 'scroll', 'clear', 'set_pixel', 'get_pixel', 'on', 'off', 'is_on', 'read_light_level'],
    button_a: ['is_pressed', 'was_pressed', 'get_presses'],
    button_b: ['is_pressed', 'was_pressed', 'get_presses'],
    accelerometer: ['get_x', 'get_y', 'get_z', 'get_values', 'get_strength', 'current_gesture', 'is_gesture',
      'was_gesture', 'get_gestures', 'set_range'],
    compass: ['calibrate', 'is_calibrated', 'clear_calibration', 'get_x', 'get_y', 'get_z', 'heading', 'get_field_strength'],
    Image: ['HEART', 'HEART_SMALL', 'HAPPY', 'SMILE', 'SAD', 'CONFUSED', 'ANGRY', 'ASLEEP', 'SURPRISED', 'SILLY',
      'FABULOUS', 'MEH', 'YES', 'NO', 'TRIANGLE', 'TRIANGLE_LEFT', 'CHESSBOARD', 'DIAMOND', 'DIAMOND_SMALL',
      'SQUARE', 'SQUARE_SMALL', 'RABBIT', 'COW', 'MUSIC_CROTCHET', 'MUSIC_QUAVER', 'MUSIC_QUAVERS', 'PITCHFORK',
      'XMAS', 'PACMAN', 'TARGET', 'TSHIRT', 'ROLLERSKATE', 'DUCK', 'HOUSE', 'TORTOISE', 'BUTTERFLY',
      'STICKFIGURE', 'GHOST', 'SWORD', 'GIRAFFE', 'SKULL', 'UMBRELLA', 'SNAKE', 'ALL_CLOCKS', 'ALL_ARROWS',
      'ARROW_N', 'ARROW_NE', 'ARROW_E', 'ARROW_SE', 'ARROW_S', 'ARROW_SW', 'ARROW_W', 'ARROW_NW',
      'CLOCK12', 'CLOCK1', 'CLOCK2', 'CLOCK3', 'CLOCK6', 'CLOCK9'],
    music: ['play', 'pitch', 'stop', 'reset', 'set_tempo', 'get_tempo', 'DADADADUM', 'ENTERTAINER', 'PRELUDE',
      'ODE', 'NYAN', 'RINGTONE', 'FUNK', 'BLUES', 'BIRTHDAY', 'WEDDING', 'FUNERAL', 'PUNCHLINE', 'PYTHON',
      'BADDY', 'CHASE', 'BA_DING', 'WAWAWAWAA', 'JUMP_UP', 'JUMP_DOWN', 'POWER_UP', 'POWER_DOWN'],
    radio: ['on', 'off', 'config', 'reset', 'send', 'receive', 'send_bytes', 'receive_bytes', 'receive_bytes_into',
      'receive_full', 'RATE_1MBIT', 'RATE_2MBIT'],
    speech: ['say', 'pronounce', 'sing', 'translate'],
    neopixel: ['NeoPixel'],
    microphone: ['current_event', 'was_event', 'is_event', 'get_events', 'set_threshold', 'sound_level'],
    speaker: ['on', 'off', 'is_on'],
    Sound: ['GIGGLE', 'HAPPY', 'HELLO', 'MYSTERIOUS', 'SAD', 'SLIDE', 'SOARING', 'SPRING', 'TWINKLE', 'YAWN'],
    SoundEvent: ['LOUD', 'QUIET'],
    audio: ['play', 'is_playing', 'stop', 'AudioFrame', 'SoundEffect'],
    pin_logo: ['is_touched', 'set_touch_mode'],
    utime: ['sleep', 'sleep_ms', 'sleep_us', 'ticks_ms', 'ticks_us', 'ticks_diff', 'ticks_add'],
    time: ['sleep', 'sleep_ms', 'sleep_us', 'ticks_ms', 'ticks_us', 'ticks_diff', 'ticks_add'],
    os: ['listdir', 'remove', 'size', 'uname'],
    gc: ['collect', 'mem_free', 'mem_alloc', 'enable', 'disable'],
    random: ['random', 'randint', 'randrange', 'choice', 'uniform', 'seed', 'getrandbits'],
    power: ['off', 'deep_sleep'],
    log: ['add', 'set_labels', 'delete', 'set_mirroring', 'MILLISECONDS', 'SECONDS', 'MINUTES', 'HOURS', 'DAYS'],
  },
  classes: {
    MicroBitPin: ['read_digital', 'write_digital', 'read_analog', 'write_analog', 'set_analog_period',
      'set_analog_period_microseconds', 'is_touched', 'set_touch_mode', 'set_pull', 'get_pull', 'get_mode',
      'PULL_UP', 'PULL_DOWN', 'NO_PULL', 'RESISTIVE', 'CAPACITIVE'],
    NeoPixel: ['show', 'clear', 'fill', 'write'],
    Image: ['width', 'height', 'set_pixel', 'get_pixel', 'shift_left', 'shift_right', 'shift_up', 'shift_down',
      'crop', 'copy', 'invert', 'fill', 'blit'],
  },
};
for (let i = 0; i <= 20; i++) MICROBIT_API.members['pin' + i] = MICROBIT_API.classes.MicroBitPin;

// ---------------- 예제 템플릿 ----------------
const PICO_TEMPLATES = [
  {
    id: 'blink', title: '내장 LED 깜빡이기', desc: 'machine.Pin 으로 보드 LED 제어', code:
`from machine import Pin
import time

# "LED" 는 Pico / Pico W / Pico 2 모두에서 보드 LED 를 가리킵니다
led = Pin("LED", Pin.OUT)

while True:
    led.toggle()
    time.sleep(0.5)
` },
  {
    id: 'pwm', title: 'PWM 으로 LED 밝기 조절', desc: 'GP15 에 연결한 LED 가 서서히 밝아졌다 어두워짐', code:
`from machine import Pin, PWM
import time

pwm = PWM(Pin(15))
pwm.freq(1000)

while True:
    for duty in range(0, 65536, 1024):
        pwm.duty_u16(duty)
        time.sleep_ms(10)
    for duty in range(65535, -1, -1024):
        pwm.duty_u16(duty)
        time.sleep_ms(10)
` },
  {
    id: 'temp', title: '내장 온도 센서 읽기', desc: 'ADC(4) 로 RP2040 칩 온도 측정', code:
`from machine import ADC
import time

sensor = ADC(4)              # 내부 온도 센서 채널
FACTOR = 3.3 / 65535

while True:
    voltage = sensor.read_u16() * FACTOR
    temp_c = 27 - (voltage - 0.706) / 0.001721
    print("온도: {:.1f} °C".format(temp_c))
    time.sleep(1)
` },
  {
    id: 'adc', title: '가변저항 (ADC) 읽기', desc: 'GP26(ADC0) 아날로그 입력', code:
`from machine import ADC, Pin
import time

pot = ADC(Pin(26))

while True:
    raw = pot.read_u16()
    print("값:", raw, " 전압: {:.2f} V".format(raw * 3.3 / 65535))
    time.sleep(0.2)
` },
  {
    id: 'button', title: '버튼 입력 + 인터럽트', desc: 'GP14 버튼을 누르면 LED 토글', code:
`from machine import Pin
import time

led = Pin("LED", Pin.OUT)
button = Pin(14, Pin.IN, Pin.PULL_UP)   # 버튼 한쪽은 GP14, 다른쪽은 GND

last = 0

def on_press(pin):
    global last
    now = time.ticks_ms()
    if time.ticks_diff(now, last) > 200:   # 디바운스
        led.toggle()
        print("버튼 눌림!")
    last = now

button.irq(trigger=Pin.IRQ_FALLING, handler=on_press)

while True:
    time.sleep(1)
` },
  {
    id: 'timer', title: 'Timer 주기 콜백', desc: '하드웨어 타이머로 LED 깜빡이기', code:
`from machine import Pin, Timer

led = Pin("LED", Pin.OUT)
tim = Timer()

def tick(t):
    led.toggle()

tim.init(freq=2, mode=Timer.PERIODIC, callback=tick)
print("타이머 시작 - 정지 버튼으로 멈추세요")
` },
  {
    id: 'servo', title: '서보 모터 제어', desc: 'GP16 에 연결한 SG90 서보 각도 제어', code:
`from machine import Pin, PWM
import time

servo = PWM(Pin(16))
servo.freq(50)

def angle(deg):
    # 0.5ms ~ 2.5ms 펄스 폭
    us = 500 + (deg / 180) * 2000
    servo.duty_ns(int(us * 1000))

while True:
    for a in (0, 90, 180, 90):
        angle(a)
        print("각도:", a)
        time.sleep(1)
` },
  {
    id: 'i2c', title: 'I2C 장치 스캔', desc: 'SDA=GP4, SCL=GP5', code:
`from machine import Pin, I2C

i2c = I2C(0, sda=Pin(4), scl=Pin(5), freq=400000)
devices = i2c.scan()

if devices:
    for d in devices:
        print("장치 발견: 0x{:02X}".format(d))
else:
    print("I2C 장치가 없습니다")
` },
  {
    id: 'neopixel', title: 'NeoPixel (WS2812) 무지개', desc: 'GP0 에 8개 LED', code:
`from machine import Pin
from neopixel import NeoPixel
import time

N = 8
np = NeoPixel(Pin(0), N)

def wheel(pos):
    pos %= 255
    if pos < 85:
        return (255 - pos * 3, pos * 3, 0)
    if pos < 170:
        pos -= 85
        return (0, 255 - pos * 3, pos * 3)
    pos -= 170
    return (pos * 3, 0, 255 - pos * 3)

j = 0
while True:
    for i in range(N):
        np[i] = wheel(i * 255 // N + j)
    np.write()
    j = (j + 5) % 255
    time.sleep_ms(30)
` },
  {
    id: 'pio', title: 'PIO 로 LED 깜빡이기', desc: 'rp2 의 PIO 상태머신 사용 (GP25)', code:
`import rp2
from machine import Pin
import time

@rp2.asm_pio(set_init=rp2.PIO.OUT_LOW)
def blink():
    wrap_target()
    set(pins, 1)   [31]
    nop()          [31]
    nop()          [31]
    set(pins, 0)   [31]
    nop()          [31]
    nop()          [31]
    wrap()

# 2000 Hz 로 동작 -> 약 1초에 한 번 깜빡임
sm = rp2.StateMachine(0, blink, freq=2000, set_base=Pin(25))
sm.active(1)
time.sleep(5)
sm.active(0)
print("PIO 종료")
` },
  {
    id: 'bootsel', title: 'BOOTSEL 버튼 읽기', desc: '보드의 BOOTSEL 버튼을 입력으로 사용', code:
`import rp2
import time
from machine import Pin

led = Pin("LED", Pin.OUT)

while True:
    pressed = rp2.bootsel_button()
    led.value(pressed)
    if pressed:
        print("BOOTSEL 눌림")
    time.sleep_ms(100)
` },
  {
    id: 'thread', title: '듀얼 코어 (_thread)', desc: '두 번째 코어에서 작업 실행', code:
`import _thread
import time
from machine import Pin

led = Pin("LED", Pin.OUT)

def core1():
    while True:
        led.toggle()
        time.sleep(0.25)

_thread.start_new_thread(core1, ())

count = 0
while True:
    count += 1
    print("코어0 카운트:", count)
    time.sleep(1)
` },
  {
    id: 'wifi', title: 'Wi-Fi 연결 (Pico W)', desc: 'network.WLAN 으로 무선 연결', boards: ['pico-w', 'pico2-w'], code:
`import network
import time

SSID = "your-ssid"
PASSWORD = "your-password"

wlan = network.WLAN(network.STA_IF)
wlan.active(True)
wlan.connect(SSID, PASSWORD)

for _ in range(20):
    if wlan.isconnected():
        break
    print("연결 중...")
    time.sleep(1)

if wlan.isconnected():
    print("연결됨:", wlan.ifconfig()[0])
else:
    print("연결 실패, 상태:", wlan.status())
` },
];

const MICROBIT_TEMPLATES = [
  {
    id: 'hello', title: '글자 스크롤 & 하트', desc: 'display 로 문자와 이미지 표시', code:
`from microbit import *

display.scroll("Hello!")

while True:
    display.show(Image.HEART)
    sleep(500)
    display.show(Image.HEART_SMALL)
    sleep(500)
` },
  {
    id: 'buttons', title: '버튼 A / B', desc: '버튼에 따라 다른 이미지 표시', code:
`from microbit import *

while True:
    if button_a.is_pressed() and button_b.is_pressed():
        display.show(Image.SURPRISED)
    elif button_a.is_pressed():
        display.show(Image.HAPPY)
    elif button_b.is_pressed():
        display.show(Image.SAD)
    else:
        display.clear()
    sleep(50)
` },
  {
    id: 'counter', title: '버튼 카운터', desc: 'was_pressed 로 숫자 세기', code:
`from microbit import *

count = 0
display.show(count)

while True:
    if button_a.was_pressed():
        count += 1
        display.show(count)
    if button_b.was_pressed():
        count = 0
        display.show(count)
    sleep(20)
` },
  {
    id: 'accel', title: '가속도 센서 기울기', desc: 'x 기울기에 따라 화살표 표시', code:
`from microbit import *

while True:
    x = accelerometer.get_x()
    y = accelerometer.get_y()
    print((x, y, accelerometer.get_z()))
    if x > 300:
        display.show(Image.ARROW_E)
    elif x < -300:
        display.show(Image.ARROW_W)
    elif y > 300:
        display.show(Image.ARROW_S)
    elif y < -300:
        display.show(Image.ARROW_N)
    else:
        display.show("-")
    sleep(100)
` },
  {
    id: 'dice', title: '흔들면 주사위', desc: '제스처(shake) + random', code:
`from microbit import *
import random

display.scroll("Shake!")

while True:
    if accelerometer.was_gesture("shake"):
        n = random.randint(1, 6)
        display.show(n)
        print("주사위:", n)
    sleep(50)
` },
  {
    id: 'music', title: '음악 재생', desc: 'music 모듈 내장 멜로디', code:
`from microbit import *
import music

display.show(Image.MUSIC_QUAVERS)
music.play(music.BIRTHDAY)

# 직접 음표 작성: 음이름+옥타브:박자
tune = ["C4:4", "D4:4", "E4:4", "C4:4", "C4:4", "D4:4", "E4:4", "C4:4"]
music.play(tune)
display.clear()
` },
  {
    id: 'sensors', title: '온도 & 밝기 센서', desc: 'temperature(), read_light_level()', code:
`from microbit import *

while True:
    t = temperature()
    light = display.read_light_level()
    print("온도:", t, "밝기:", light)
    if button_a.is_pressed():
        display.scroll(str(t) + "C")
    if button_b.is_pressed():
        display.scroll(str(light))
    sleep(500)
` },
  {
    id: 'compass', title: '나침반', desc: 'compass.heading() 으로 북쪽 가리키기', code:
`from microbit import *

compass.calibrate()   # 화면 안내에 따라 기울여서 보정

while True:
    heading = compass.heading()
    needle = ((15 - heading) // 30) % 12
    display.show(Image.ALL_CLOCKS[needle])
    sleep(100)
` },
  {
    id: 'radio', title: '라디오 통신', desc: '두 대의 micro:bit 간 메시지 송수신', code:
`from microbit import *
import radio

radio.on()
radio.config(group=7)

while True:
    if button_a.was_pressed():
        radio.send("hello")
        display.show(Image.ARROW_N)
    msg = radio.receive()
    if msg:
        print("수신:", msg)
        display.scroll(msg)
    sleep(20)
` },
  {
    id: 'pins', title: '핀 입출력 & 터치', desc: 'pin0 터치, pin1 디지털 출력, pin2 아날로그 입력', code:
`from microbit import *

while True:
    if pin0.is_touched():
        display.show(Image.YES)
        pin1.write_digital(1)
    else:
        display.show(Image.NO)
        pin1.write_digital(0)
    print("pin2:", pin2.read_analog())
    sleep(100)
` },
  {
    id: 'animation', title: '사용자 이미지 애니메이션', desc: 'Image 문자열로 직접 그리기', code:
`from microbit import *

boat1 = Image("05050:"
              "05050:"
              "05050:"
              "99999:"
              "09990")
frames = [boat1.shift_up(i) for i in range(6)]

while True:
    display.show(frames, delay=200)
    display.show(Image.ALL_ARROWS, delay=100)
` },
  {
    id: 'v2sound', title: 'V2: 마이크 & 스피커 & 로고 터치', desc: 'micro:bit V2 전용 기능', boards: ['microbit-v2'], code:
`from microbit import *

while True:
    if pin_logo.is_touched():
        audio.play(Sound.HELLO)
    if microphone.was_event(SoundEvent.LOUD):
        display.show(Image.SURPRISED)
        sleep(500)
    # 소리 크기(0~255)를 막대 그래프로 표시
    bars = microphone.sound_level() * 6 // 256
    display.clear()
    for y in range(bars):
        for x in range(5):
            display.set_pixel(x, 4 - y, 9)
    sleep(50)
` },
  {
    id: 'neopixel', title: 'NeoPixel 제어', desc: 'pin0 에 연결된 WS2812', code:
`from microbit import *
import neopixel
from random import randint

np = neopixel.NeoPixel(pin0, 8)

while True:
    for i in range(len(np)):
        np[i] = (randint(0, 60), randint(0, 60), randint(0, 60))
    np.show()
    sleep(200)
` },
];

const GENERIC_TEMPLATES = [
  {
    id: 'hello', title: '기본 예제', desc: '시스템 정보 출력', code:
`import sys
import os
import gc

print("플랫폼:", sys.platform)
print("버전:", sys.version)
try:
    print("장치:", os.uname().machine)
except Exception:
    pass
print("여유 메모리:", gc.mem_free())
` },
  {
    id: 'blink', title: 'LED 깜빡이기', desc: 'machine.Pin (핀 번호는 보드에 맞게 수정)', code:
`from machine import Pin
import time

led = Pin(2, Pin.OUT)   # 보드에 맞게 핀 번호 변경

while True:
    led.value(not led.value())
    time.sleep(0.5)
` },
];

export const BOARDS = {
  pico: { id: 'pico', family: 'pico', name: 'Raspberry Pi Pico', short: 'Pico', color: '#c51a4a', api: PICO_API, templates: PICO_TEMPLATES },
  'pico-w': { id: 'pico-w', family: 'pico', name: 'Raspberry Pi Pico W', short: 'Pico W', color: '#c51a4a', api: PICO_API, templates: PICO_TEMPLATES },
  pico2: { id: 'pico2', family: 'pico', name: 'Raspberry Pi Pico 2', short: 'Pico 2', color: '#c51a4a', api: PICO_API, templates: PICO_TEMPLATES },
  'pico2-w': { id: 'pico2-w', family: 'pico', name: 'Raspberry Pi Pico 2 W', short: 'Pico 2 W', color: '#c51a4a', api: PICO_API, templates: PICO_TEMPLATES },
  microbit: { id: 'microbit', family: 'microbit', name: 'BBC micro:bit V1', short: 'micro:bit', color: '#00a0a0', api: MICROBIT_API, templates: MICROBIT_TEMPLATES },
  'microbit-v2': { id: 'microbit-v2', family: 'microbit', name: 'BBC micro:bit V2', short: 'micro:bit V2', color: '#00a0a0', api: MICROBIT_API, templates: MICROBIT_TEMPLATES },
  generic: { id: 'generic', family: 'generic', name: 'MicroPython 장치', short: 'MicroPython', color: '#3572a5', api: { modules: PICO_API.modules, members: PICO_API.members, classes: PICO_API.classes }, templates: GENERIC_TEMPLATES },
};

export function registerBoard(def) {
  BOARDS[def.id] = { family: def.id, api: { modules: [], members: {}, classes: {} }, templates: [], ...def };
}

export function templatesFor(boardId) {
  const b = BOARDS[boardId] || BOARDS.generic;
  return b.templates.filter(t => !t.boards || t.boards.includes(boardId));
}

// USB VID 로 1차 추정
export function guessBoardFromUsb(vid) {
  if (vid === 0x2E8A) return 'pico';
  if (vid === 0x0D28) return 'microbit-v2';
  return null;
}

// 장치에서 받은 "platform|machine" 문자열로 정확히 판별
export function boardFromInfo(platform, machine) {
  const m = (machine || '').toLowerCase();
  if (platform === 'rp2') {
    const two = m.includes('rp2350') || m.includes('pico 2');
    const w = m.includes('pico w') || m.includes('pico 2 w') || m.includes('cyw43');
    return two ? (w ? 'pico2-w' : 'pico2') : (w ? 'pico-w' : 'pico');
  }
  if (platform === 'microbit' || m.includes('micro:bit')) {
    return m.includes('nrf51') ? 'microbit' : 'microbit-v2';
  }
  return 'generic';
}
