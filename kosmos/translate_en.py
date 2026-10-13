"""Собирает английскую версию сайта для GitHub Pages: kosmos/index.html → docs/index.html.

Русская страница остаётся источником: вся вёрстка и логика правятся там, а этот скрипт
заменяет тексты, единицы и форматирование чисел на английские. Если после замены в файле
осталась кириллица, скрипт падает и показывает строки, которые нужно добавить в словарь.

    python3 kosmos/translate_en.py
"""
import re
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).parent
SRC = HERE / "index.html"
DOCS = HERE.parent / "docs"

FAVICON = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E"
           "%3Ccircle cx='16' cy='16' r='15' fill='%2305060b'/%3E%3Cellipse cx='16' cy='16' rx='14' ry='4' "
           "fill='none' stroke='%23ffa04a' stroke-width='2'/%3E%3Ccircle cx='16' cy='16' r='7' fill='%23000' "
           "stroke='%23ffe1b4' stroke-width='1.5'/%3E%3C/svg%3E")

# (русский фрагмент, английский фрагмент) — применяются по порядку, каждый должен найтись
PAIRS = [
    # --- шапка документа ---
    ('<html lang="ru">', '<html lang="en">'),
    ('<title>Горизонт событий</title>', '<title>Event Horizon</title>'),
    ('<meta name="description" content="Чёрные дыры, квантовая физика и история Вселенной: три коротких видео и опыты, которые можно потрогать.">',
     '<meta name="description" content="Black holes, quantum physics and the history of the Universe: three short videos and experiments you can play with.">\n'
     '<meta property="og:title" content="Event Horizon">\n'
     '<meta property="og:description" content="Black holes, quantum physics and the history of the Universe: three short videos and experiments you can play with.">\n'
     '<meta property="og:type" content="website">\n'
     f'<link rel="icon" href="{FAVICON}">'),
    ('/* верхняя панель и вкладки */', '/* top bar and tabs */'),
    ('/* герой */', '/* hero */'),
    ('/* кнопки и поля */', '/* buttons and fields */'),
    ('/* панели */', '/* panels */'),
    ('/* видео */', '/* videos */'),
    ('/* карточки опытов */', '/* experiment cards */'),
    ('/* масштаб */', '/* scale */'),
    ('/* календарь */', '/* calendar */'),
    ('.events li{display:grid;grid-template-columns:1.5rem 7rem minmax(0,1fr);', '.events li{display:grid;grid-template-columns:1.5rem 7.5rem minmax(0,1fr);'),
    # --- вкладки (заодно английские адреса разделов: #black-holes и т. д.) ---
    ('<a class="brand" href="#top">Горизонт событий</a>', '<a class="brand" href="#top">Event Horizon</a>'),
    ('aria-label="Разделы"', 'aria-label="Sections"'),
    ('</svg>Видео</button>', '</svg>Videos</button>'),
    ('</svg>Чёрные дыры</button>', '</svg>Black holes</button>'),
    ('</svg>Кванты</button>', '</svg>Quantum</button>'),
    ('</svg>Вселенная</button>', '</svg>Universe</button>'),
    # --- герой ---
    ('aria-label="Анимация: чёрная дыра с аккреционным диском, свет которого изгибается гравитацией"',
     'aria-label="Animation: a black hole with an accretion disk whose light is bent by gravity"'),
    ('Это расчёт в реальном времени: свет дальней части диска огибает чёрную дыру, поэтому диск виден и над тенью, и под ней. Ведите курсором, чтобы сменить ракурс.',
     'This is computed live, not a picture: light from the far side of the disk bends around the black hole, so the disk shows both above and below the shadow. Move the cursor to change the view.'),
    ('<h1><span class="a">Горизонт</span><span class="b">событий</span></h1>', '<h1><span class="a">Event</span><span class="b">horizon</span></h1>'),
    ('Три коротких видео и восемь опытов, которые можно потрогать: чёрные дыры, квантовый мир и вся история Вселенной.',
     'Three short videos and eight experiments you can play with: black holes, the quantum world and the whole history of the Universe.'),
    ('▶ Смотреть видео</button>', '▶ Watch the videos</button>'),
    ('data-go="dyry">Опыты</button>', 'data-go="dyry">Experiments</button>'),
    # --- видео ---
    ('<!-- ============ ВИДЕО ============ -->', '<!-- ============ VIDEOS ============ -->'),
    ('<h2>Видео</h2>', '<h2>Videos</h2>'),
    ('<p>Три ролика по полминуты в вертикальном формате: смотреть с телефона или выкладывать в Shorts.</p>',
     '<p>Three half-minute videos in vertical format: watch them on your phone or post them to Shorts.</p>'),
    ('poster="video/web/kosmos-01.jpg" src="video/web/kosmos-01.mp4" aria-label="Видео: что будет, если упасть в чёрную дыру"',
     'poster="video/event-horizon-01.jpg" src="video/event-horizon-01.mp4" aria-label="Video: what happens if you fall into a black hole"'),
    ('<h3>Что будет, если упасть в чёрную дыру</h3>', '<h3>What happens if you fall into a black hole</h3>'),
    ('<p>Свет огибает дыру, время у горизонта замедляется, а маленькая дыра растягивает в спагетти.</p>',
     '<p>Light bends around it, time near the horizon slows down, and a small black hole stretches you into spaghetti.</p>'),
    ('poster="video/web/kosmos-02.jpg" src="video/web/kosmos-02.mp4" aria-label="Видео: двухщелевой опыт"',
     'poster="video/event-horizon-02.jpg" src="video/event-horizon-02.mp4" aria-label="Video: the double-slit experiment"'),
    ('<h3>Самый странный опыт в физике</h3>', '<h3>The weirdest experiment in physics</h3>'),
    ('<p>Электроны летят по одному, но складываются в полосы, как волна. Пока за ними не начинают следить.</p>',
     '<p>Electrons fly one at a time but add up to stripes, like a wave. Until someone starts watching.</p>'),
    ('poster="video/web/kosmos-03.jpg" src="video/web/kosmos-03.mp4" aria-label="Видео: история Вселенной за один год"',
     'poster="video/event-horizon-03.jpg" src="video/event-horizon-03.mp4" aria-label="Video: the history of the Universe in one year"'),
    ('<h3>Вся история Вселенной за один год</h3>', '<h3>The whole history of the Universe in one year</h3>'),
    ('>Попробовать →</button>', '>Try it →</button>'),
    ('<p>Большой взрыв 1 января, динозавры на Рождество, а Гагарин за 0,15 секунды до полуночи.</p>',
     '<p>The Big Bang on January 1, dinosaurs on Christmas Day, and Gagarin 0.15 seconds before midnight.</p>'),
    # --- чёрные дыры ---
    ('<!-- ============ ЧЁРНЫЕ ДЫРЫ ============ -->', '<!-- ============ BLACK HOLES ============ -->'),
    ('<h2>Чёрные дыры</h2>', '<h2>Black holes</h2>'),
    ('<p>Масса, сжатая так сильно, что даже свет не может вырваться. Граница невозврата: <span class="formula">',
     '<p>Mass squeezed so tightly that not even light can escape. The point of no return: <span class="formula">'),
    ('<h3>Сожмите что угодно</h3>', '<h3>Squeeze anything</h3>'),
    ('<p>Выберите объект, и калькулятор покажет, до какого размера его надо сжать, чтобы получилась чёрная дыра.</p>',
     '<p>Pick an object and the calculator shows how small it must be squeezed to become a black hole.</p>'),
    ('<span class="label">Радиус горизонта</span>', '<span class="label">Horizon radius</span>'),
    ('<span class="label">Диаметр</span>', '<span class="label">Diameter</span>'),
    ('<span class="label">Средняя плотность</span>', '<span class="label">Average density</span>'),
    ('aria-label="Объекты"', 'aria-label="Objects"'),
    ('>Масса, кг (логарифмическая шкала)</label>', '>Mass, kg (log scale)</label>'),
    ('aria-label="Сравнение размера горизонта с похожим по размеру объектом"', 'aria-label="The horizon next to a familiar object of similar size"'),
    ('<h3>Время у горизонта</h3>', '<h3>Time near the horizon</h3>'),
    ('<p>Гравитация замедляет время. Подвиньте ползунок к горизонту и посмотрите, сколько пройдёт вдали, пока у вас идёт один час.</p>',
     '<p>Gravity slows time down. Move the slider toward the horizon and see how much time passes far away while one hour passes for you.</p>'),
    ('<span class="label">1 час у вас равен</span>', '<span class="label">1 hour for you equals</span>'),
    ('<span class="label">Расстояние</span>', '<span class="label">Distance</span>'),
    ('<span class="label">Над горизонтом Sgr A*</span>', '<span class="label">Above Sgr A*’s horizon</span>'),
    ('>Близость к горизонту</label>', '>Closeness to the horizon</label>'),
    ('id="td-miller">Планета Миллер</button>', 'id="td-miller">Miller’s planet</button>'),
    ('id="td-reset">Обнулить часы</button>', 'id="td-reset">Reset clocks</button>'),
    ('aria-label="Двое часов: у горизонта и вдали от чёрной дыры"', 'aria-label="Two clocks: one near the horizon, one far from the black hole"'),
    ('<h3>Спагеттификация</h3>', '<h3>Spaghettification</h3>'),
    ('<p>Ноги тянет сильнее, чем голову. Маленькая дыра разрывает тело задолго до горизонта, а горизонт гиганта можно пересечь незаметно.</p>',
     '<p>Your feet are pulled harder than your head. A small black hole tears a body apart long before the horizon; a giant’s horizon you can cross without noticing.</p>'),
    ('<span class="label">До центра</span>', '<span class="label">To the center</span>'),
    ('<span class="label">Разница ускорений</span>', '<span class="label">Head-to-feet pull</span>'),
    ('<span class="label">Самочувствие</span>', '<span class="label">How you feel</span>'),
    ('aria-label="Масса чёрной дыры"', 'aria-label="Black hole mass"'),
    ('aria-pressed="true">10 масс Солнца</button>', 'aria-pressed="true">10 Sun masses</button>'),
    ('aria-label="Космонавт падает в чёрную дыру и растягивается приливными силами"', 'aria-label="An astronaut falls into a black hole and is stretched by tidal forces"'),
    # --- кванты ---
    ('<!-- ============ КВАНТЫ ============ -->', '<!-- ============ QUANTUM ============ -->'),
    ('<h2>Квантовый мир</h2>', '<h2>The quantum world</h2>'),
    ('<p>На масштабе атомов частица ведёт себя как волна вероятности. На этом работают лазеры, светодиоды и транзисторы.</p>',
     '<p>At the scale of atoms, a particle behaves like a wave of probability. Lasers, LEDs and transistors all run on this.</p>'),
    ('<h3>Двухщелевой опыт</h3>', '<h3>Double-slit experiment</h3>'),
    ('<p>Электроны летят по одному, но складываются в полосы, как волна. Включите детектор у щелей, и полосы пропадут.</p>',
     '<p>Electrons fly one at a time but build up stripes, like a wave. Turn on the detector at the slits and the stripes vanish.</p>'),
    ('aria-pressed="false">Детектор у щелей: выкл</button>', 'aria-pressed="false">Detector at slits: off</button>'),
    ('id="ds-fast" aria-pressed="false">Быстрее</button>', 'id="ds-fast" aria-pressed="false">Faster</button>'),
    ('id="ds-clear">Очистить</button>', 'id="ds-clear">Clear</button>'),
    ('font-size:.85rem">0 электронов</span>', 'font-size:.85rem">0 electrons</span>'),
    ('aria-label="Симуляция двухщелевого опыта"', 'aria-label="Double-slit experiment simulation"'),
    ('<h3>Туннельный эффект</h3>', '<h3>Quantum tunneling</h3>'),
    ('<p>Частице не хватает энергии перелезть через стену, но часть её волны просачивается насквозь. Так светит Солнце и работает флеш-память.</p>',
     '<p>The particle lacks the energy to climb over the wall, yet part of its wave leaks through. That is how the Sun shines and how flash memory works.</p>'),
    ('<span class="label">Прошло сквозь стену</span>', '<span class="label">Got through the wall</span>'),
    ('<span class="label">По классике</span><span class="v">0 %</span>', '<span class="label">Classical physics</span><span class="v">0%</span>'),
    ('>Толщина стены</label>', '>Wall thickness</label>'),
    ('aria-label="Решение уравнения Шрёдингера: волновой пакет налетает на барьер"', 'aria-label="A Schrödinger equation solution: a wave packet hits a barrier"'),
    ('<h3>Запутанность</h3>', '<h3>Entanglement</h3>'),
    ('<p>Измерьте одну частицу, и вторая сразу окажется противоположной на любом расстоянии. Сообщение так не передать: каждый видит случайные ↑ и ↓.</p>',
     '<p>Measure one particle and the other instantly turns out opposite, at any distance. You can’t send a message this way: each side sees random ↑ and ↓.</p>'),
    ('>Измерить сейчас</button>', '>Measure now</button>'),
    ('font-size:.85rem">Результаты появятся здесь</span>', 'font-size:.85rem">Results show up here</span>'),
    ('aria-label="Пара запутанных частиц разлетается к двум наблюдателям"', 'aria-label="A pair of entangled particles flies apart to two observers"'),
    # --- Вселенная ---
    ('<!-- ============ ВСЕЛЕННАЯ ============ -->', '<!-- ============ UNIVERSE ============ -->'),
    ('<h2>Вселенная</h2>', '<h2>The Universe</h2>'),
    ('<p>От планковской длины до наблюдаемой Вселенной и от Большого взрыва до сегодняшнего дня.</p>',
     '<p>From the Planck length to the observable Universe, and from the Big Bang to today.</p>'),
    ('<h3>Масштаб всего</h3>', '<h3>The scale of everything</h3>'),
    ('<p>62 порядка величины между самым маленьким и самым большим. Нажмите «Полёт» или двигайте ползунок.</p>',
     '<p>62 orders of magnitude between the smallest and the largest. Press Fly or drag the slider.</p>'),
    ('<span class="label">Ширина кадра <b id="scale-frame"', '<span class="label">Frame width <b id="scale-frame"'),
    ('letter-spacing:0">2 м</b>', 'letter-spacing:0">2 m</b>'),
    ('<h4 id="scale-name">Человек</h4>', '<h4 id="scale-name">Human</h4>'),
    ('<span class="size" id="scale-size">1,7 м</span>', '<span class="size" id="scale-size">1.7 m</span>'),
    ('>Масштаб: 10ⁿ метров</label>', '>Scale: 10ⁿ meters</label>'),
    ('aria-label="Быстрый переход"', 'aria-label="Quick jump"'),
    ('aria-pressed="false">▶ Полёт</button>', 'aria-pressed="false">▶ Fly</button>'),
    ('data-e="-9.7">Атом</button>', 'data-e="-9.7">Atom</button>'),
    ('data-e="0.55">Человек</button>', 'data-e="0.55">Human</button>'),
    ('data-e="7.4">Земля</button>', 'data-e="7.4">Earth</button>'),
    ('data-e="21.3">Галактика</button>', 'data-e="21.3">Galaxy</button>'),
    ('aria-label="Концентрические круги, показывающие размеры объектов в выбранном масштабе"', 'aria-label="Concentric circles showing object sizes at the chosen scale"'),
    ('<h3>Космический календарь</h3>', '<h3>Cosmic calendar</h3>'),
    ('<p>Вся история Вселенной, сжатая в один год: Большой взрыв 1 января в полночь, сейчас 31 декабря, 24:00. Одна секунда равна 437 годам.</p>',
     '<p>The whole history of the Universe squeezed into one year: the Big Bang at midnight on January 1, and now it is 24:00 on December 31. One second equals 437 years.</p>'),
    ('<span>Весь год</span><span>1 января → 31 декабря</span>', '<span>Whole year</span><span>Jan 1 → Dec 31</span>'),
    ('<span>31 декабря</span><span>00:00 → 24:00</span>', '<span>December 31</span><span>00:00 → 24:00</span>'),
    ('<span>Последняя минута</span>', '<span>Last minute</span>'),
    ('aria-pressed="true">❚❚ Пауза</button>', 'aria-pressed="true">❚❚ Pause</button>'),
    ('font-size:.85rem">1 января, 00:00</span>', 'font-size:.85rem">January 1, 00:00</span>'),
    ('<p>Симуляции упрощены, но формулы в них настоящие. Данные: NASA, ESA,', '<p>The simulations are simplified, but the formulas are real. Data: NASA, ESA,'),
    ('LIGO</a>, миссия «Планк».</p>', 'LIGO</a>, the Planck mission.</p>'),
    # --- числа и единицы ---
    ("new Intl.NumberFormat('ru-RU', { maximumSignificantDigits: 3 })", "new Intl.NumberFormat('en-US', { maximumSignificantDigits: 3 })"),
    ("new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 })", "new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })"),
    ("new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })", "new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })"),
    ("' млн';", "' million';"), ("' млрд';", "' billion';"), ("' трлн';", "' trillion';"),
    ("""function plural(n, f) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return f[2];
  if (b > 1 && b < 5) return f[1];
  if (b === 1) return f[0];
  return f[2];
}""", """function plural(n, f) { return Math.abs(n) === 1 ? f[0] : f[1]; }"""),
    ("' св. лет';", "' light-years';"), ("' а. е.';", "' AU';"), ("' км';", "' km';"), ("fmt(m) + ' м';", "fmt(m) + ' m';"),
    ("' см';", "' cm';"), ("' мм';", "' mm';"), ("' мкм';", "' µm';"), ("' нм';", "' nm';"), ("' пм';", "' pm';"),
    ("' фм';", "' fm';"), ("return sci(m) + ' м';", "return sci(m) + ' m';"),
    ("""  if (s < 60) return NF1.format(s) + ' с';
  if (s < 3600) return Math.floor(s / 60) + ' мин ' + Math.floor(s % 60) + ' с';
  if (s < 86400) return Math.floor(s / 3600) + ' ч ' + Math.floor(s % 3600 / 60) + ' мин';""",
     """  if (s < 60) return NF1.format(s) + ' s';
  if (s < 3600) return Math.floor(s / 60) + ' min ' + Math.floor(s % 60) + ' s';
  if (s < 86400) return Math.floor(s / 3600) + ' h ' + Math.floor(s % 3600 / 60) + ' min';"""),
    ("plural(n, ['день', 'дня', 'дней']) + ' ' + Math.floor(s % 86400 / 3600) + ' ч'; }", "plural(n, ['day', 'days']) + ' ' + Math.floor(s % 86400 / 3600) + ' h'; }"),
    ("return NF1.format(v) + ' ' + (Number.isInteger(v) ? plural(v, ['год', 'года', 'лет']) : 'года'); }", "return NF1.format(v) + ' ' + plural(v, ['year', 'years']); }"),
    ("return fmt(v) + ' ' + plural(v, ['год', 'года', 'лет']); }", "return fmt(v) + ' ' + plural(v, ['year', 'years']); }"),
    ("  return num(y) + ' лет';\n}", "  return num(y) + ' years';\n}"),
    # --- масштаб ---
    ("{ n: 'Планковская длина', s: 1.616e-35, k: 'q', v: 'foam', d: 'Самая маленькая длина, о которой имеет смысл говорить в современной физике. Чтобы понять, что происходит на таком масштабе, нужна квантовая теория гравитации, а её пока нет.' }",
     "{ n: 'Planck length', s: 1.616e-35, k: 'q', v: 'foam', d: 'The smallest length that makes sense in today’s physics. To understand this scale we need a quantum theory of gravity, and we do not have one yet.' }"),
    ("{ n: 'Электрон и кварки', s: 1e-18, k: 'q', d: 'Эксперименты не нашли у них никакого размера. Известно только, что если он есть, то меньше 10⁻¹⁸ м.' }",
     "{ n: 'Electron and quarks', s: 1e-18, k: 'q', d: 'Experiments have found no size for them at all. If they have one, it is smaller than 10⁻¹⁸ m.' }"),
    ("{ n: 'Протон', s: 1.7e-15, k: 'q', v: 'proton', d: 'Три кварка, связанные глюонами. Почти вся масса протона берётся из энергии этой связи, а не из масс самих кварков.' }",
     "{ n: 'Proton', s: 1.7e-15, k: 'q', v: 'proton', d: 'Three quarks held together by gluons. Almost all of a proton’s mass comes from the energy of that bond, not from the quarks themselves.' }"),
    ("{ n: 'Атом водорода', s: 1.06e-10, k: 'q', v: 'atom', d: 'Атом почти пустой. Если увеличить ядро до горошины, облако электрона будет почти полкилометра в поперечнике.' }",
     "{ n: 'Hydrogen atom', s: 1.06e-10, k: 'q', v: 'atom', d: 'An atom is almost empty. If the nucleus were a pea, the electron cloud would be almost half a kilometer across.' }"),
    ("{ n: 'Молекула ДНК', s: 2e-9, k: 'b', v: 'dna', d: 'Ширина двойной спирали около 2 нм. При этом ДНК из одной клетки человека, если её растянуть, будет длиной около 2 м.' }",
     "{ n: 'DNA molecule', s: 2e-9, k: 'b', v: 'dna', d: 'The double helix is about 2 nm wide. Yet the DNA from a single human cell, stretched out, is about 2 m long.' }"),
    ("{ n: 'Вирус гриппа', s: 1e-7, k: 'b', v: 'virus', d: 'Около 100 нм. Это меньше длины волны видимого света, поэтому вирус не разглядеть в обычный микроскоп.' }",
     "{ n: 'Flu virus', s: 1e-7, k: 'b', v: 'virus', d: 'About 100 nm. That is shorter than the wavelength of visible light, so an ordinary microscope cannot see it.' }"),
    ("{ n: 'Эритроцит', s: 7.5e-6, k: 'b', v: 'cell', d: 'Красная клетка крови. В теле взрослого человека их около 25 триллионов.' }",
     "{ n: 'Red blood cell', s: 7.5e-6, k: 'b', v: 'cell', d: 'An adult body holds about 25 trillion of them.' }"),
    ("{ n: 'Человек', s: 1.7, k: 'b', v: 'human', d: 'Человек примерно в 10³⁵ раз больше планковской длины и в 5·10²⁶ раз меньше наблюдаемой Вселенной.' }",
     "{ n: 'Human', s: 1.7, k: 'b', v: 'human', d: 'A person is about 10³⁵ times bigger than the Planck length and 5·10²⁶ times smaller than the observable Universe.' }"),
    ("{ n: 'Горизонт дыры массой с Солнце', s: 5.9e3, k: 'c', v: 'bh', d: 'Если сжать Солнце в чёрную дыру, её горизонт будет около 6 км в диаметре. Это меньше большого города.' }",
     "{ n: 'Horizon of a Sun-mass black hole', s: 5.9e3, k: 'c', v: 'bh', d: 'Squeeze the Sun into a black hole and its horizon is about 6 km across. Smaller than a big city.' }"),
    ("{ n: 'Эверест', s: 8849, k: 'b', v: 'mountain', d: 'Высота 8849 м. На Марсе есть гора в два с половиной раза выше: Олимп, около 22 км.' }",
     "{ n: 'Mount Everest', s: 8849, k: 'b', v: 'mountain', d: '8,849 m tall. Mars has a mountain two and a half times higher: Olympus Mons, about 22 km.' }"),
    ("{ n: 'Земля', s: 1.2742e7, k: 'c', v: 'earth', d: '12 742 км в диаметре. Свет облетел бы её по экватору 7,5 раза за одну секунду.' }",
     "{ n: 'Earth', s: 1.2742e7, k: 'c', v: 'earth', d: '12,742 km across. Light could circle the equator 7.5 times in one second.' }"),
    ("{ n: 'Солнце', s: 1.3927e9, k: 'c', v: 'sun', d: '1,39 млн км в диаметре. Внутри поместилось бы около 1,3 миллиона Земель.' }",
     "{ n: 'Sun', s: 1.3927e9, k: 'c', v: 'sun', d: '1.39 million km across. About 1.3 million Earths would fit inside.' }"),
    ("{ n: 'Орбита Нептуна', s: 9e12, k: 'c', v: 'orbit', d: 'Около 9 млрд км в поперечнике. Свет от Солнца до Нептуна идёт около 4 часов.' }",
     "{ n: 'Neptune’s orbit', s: 9e12, k: 'c', v: 'orbit', d: 'About 9 billion km across. Sunlight takes about 4 hours to reach Neptune.' }"),
    ("{ n: 'Горизонт M87*', s: 3.8e13, k: 'c', v: 'bh', d: 'Эта чёрная дыра в 6,5 млрд раз тяжелее Солнца. Её горизонт в 4 раза шире орбиты Нептуна.' }",
     "{ n: 'Horizon of M87*', s: 3.8e13, k: 'c', v: 'bh', d: 'This black hole is 6.5 billion times heavier than the Sun. Its horizon is 4 times wider than Neptune’s orbit.' }"),
    ("{ n: 'Световой год', s: 9.46e15, k: 'c', d: 'Расстояние, которое свет проходит за год: 9,46 трлн км. До ближайшей звезды 4,24 световых года.' }",
     "{ n: 'Light-year', s: 9.46e15, k: 'c', d: 'The distance light travels in a year: 9.46 trillion km. The nearest star is 4.24 light-years away.' }"),
    ("{ n: 'Млечный Путь', s: 9.5e20, k: 'c', v: 'galaxy', d: 'Наша Галактика: около 100 000 световых лет в поперечнике и от 100 до 400 млрд звёзд.' }",
     "{ n: 'Milky Way', s: 9.5e20, k: 'c', v: 'galaxy', d: 'Our galaxy: about 100,000 light-years across, with 100 to 400 billion stars.' }"),
    ("{ n: 'Наблюдаемая Вселенная', s: 8.8e26, k: 'c', v: 'universe', d: 'Около 93 млрд световых лет в диаметре. Это больше, чем удвоенные 13,8 млрд лет, потому что пространство всё это время расширялось.' }",
     "{ n: 'Observable Universe', s: 8.8e26, k: 'c', v: 'universe', d: 'About 93 billion light-years across. That is more than twice 13.8 billion because space kept expanding the whole time.' }"),
    ("scaleFly.textContent = on ? '❚❚ Пауза' : '▶ Полёт'; }", "scaleFly.textContent = on ? '❚❚ Pause' : '▶ Fly'; }"),
    ("ctx.fillText('кадр ≈ 10' + sup(Math.round(sc.e)) + ' м', w - 16, yb);", "ctx.fillText('frame ≈ 10' + sup(Math.round(sc.e)) + ' m', w - 16, yb);"),
    # --- калькулятор ---
    ("{ n: 'Человек', m: 70 }, { n: 'Земля', m: 5.972e24 }, { n: 'Солнце', m: MSUN }, { n: 'Лебедь X-1', m: 21.2 * MSUN },",
     "{ n: 'Human', m: 70 }, { n: 'Earth', m: 5.972e24 }, { n: 'Sun', m: MSUN }, { n: 'Cygnus X-1', m: 21.2 * MSUN },"),
    ("""  { n: 'протон', d: 1.7e-15 }, { n: 'атом', d: 1.06e-10 }, { n: 'вирус', d: 1e-7 }, { n: 'эритроцит', d: 7.5e-6 },
  { n: 'песчинка', d: 5e-4 }, { n: 'виноградина', d: 2e-2 }, { n: 'человек', d: 1.7 }, { n: 'футбольное поле', d: 105 },
  { n: 'высота Эвереста', d: 8849 }, { n: 'Москва в пределах МКАД', d: 3.5e4 }, { n: 'Луна', d: 3.474e6 }, { n: 'Земля', d: 1.2742e7 },
  { n: 'Солнце', d: 1.3927e9 }, { n: 'орбита Меркурия', d: 1.16e11 }, { n: 'орбита Земли', d: 2.99e11 }, { n: 'орбита Нептуна', d: 9e12 }""",
     """  { n: 'a proton', d: 1.7e-15 }, { n: 'an atom', d: 1.06e-10 }, { n: 'a virus', d: 1e-7 }, { n: 'a red blood cell', d: 7.5e-6 },
  { n: 'a grain of sand', d: 5e-4 }, { n: 'a grape', d: 2e-2 }, { n: 'a person', d: 1.7 }, { n: 'a football field', d: 105 },
  { n: 'Mount Everest', d: 8849 }, { n: 'Manhattan', d: 2.16e4 }, { n: 'the Moon', d: 3.474e6 }, { n: 'the Earth', d: 1.2742e7 },
  { n: 'the Sun', d: 1.3927e9 }, { n: 'Mercury’s orbit', d: 1.16e11 }, { n: 'Earth’s orbit', d: 2.99e11 }, { n: 'Neptune’s orbit', d: 9e12 }"""),
    ("""  if (t < 10) { const v = Math.round(t * 10) / 10; return NF1.format(v) + ' ' + (Number.isInteger(v) ? plural(v, ['раз', 'раза', 'раз']) : 'раза'); }
  if (t < 1e6) { const v = Number(t.toPrecision(3)); return fmt(v) + ' ' + plural(v, ['раз', 'раза', 'раз']); }
  return num(t) + ' раз';""",
     """  if (t < 10) return NF1.format(Math.round(t * 10) / 10) + ' times';
  if (t < 1e6) return fmt(Number(t.toPrecision(3))) + ' times';
  return num(t) + ' times';"""),
    ("num(M / MSUN) + ' M☉ (' + sci(M) + ' кг)' : (M < 1e6 ? fmt(M) : sci(M)) + ' кг';", "num(M / MSUN) + ' M☉ (' + sci(M) + ' kg)' : (M < 1e6 ? fmt(M) : sci(M)) + ' kg';"),
    ("txt = fmtLen(D) + ', примерно как ' + best.n;", "txt = fmtLen(D) + ', about the size of ' + best.n;"),
    ("txt = fmtLen(D) + ', в ' + timesTxt(ratio) + ' больше, чем ' + best.n;", "txt = fmtLen(D) + ', ' + timesTxt(ratio) + ' bigger than ' + best.n;"),
    ("txt = fmtLen(D) + ', в ' + timesTxt(1 / ratio) + ' меньше, чем ' + best.n;", "txt = fmtLen(D) + ', ' + timesTxt(1 / ratio) + ' smaller than ' + best.n;"),
    ("rt = fmt(rho) + ' кг/м³, это меньше плотности воздуха';", "rt = fmt(rho) + ' kg/m³, thinner than air';"),
    ("rt = fmt(rho) + ' кг/м³, это меньше плотности воды';", "rt = fmt(rho) + ' kg/m³, less dense than water';"),
    ("rt = sci(rho) + ' кг/м³, в ' + num(rho / 1000) + ' раз плотнее воды';", "rt = sci(rho) + ' kg/m³, ' + num(rho / 1000) + ' times denser than water';"),
    ("ctx.fillText('горизонт', x2, y + Math.max(rR, rH) + 14);", "ctx.fillText('horizon', x2, y + Math.max(rR, rH) + 14);"),
    ("ctx.fillText('в одном масштабе', w / 2, h - 14);", "ctx.fillText('to scale', w / 2, h - 14);"),
    # --- часы ---
    ("fmtDur(3600 * f) + ' вдали';", "fmtDur(3600 * f) + ' far away';"),
    ("ctx.fillText('у горизонта (ваши часы)', x1, y + R + 16);", "ctx.fillText('near the horizon (yours)', x1, y + R + 16);"),
    ("ctx.fillText('вдали от дыры', x2, y + R + 16);", "ctx.fillText('far from the hole', x2, y + R + 16);"),
    ("ctx.fillText('прошло ' + fmtDur(clk.el), x1, y + R + 36);", "ctx.fillText('elapsed ' + fmtDur(clk.el), x1, y + R + 36);"),
    ("ctx.fillText('прошло ' + fmtDur(clk.ef), x2, y + R + 36);", "ctx.fillText('elapsed ' + fmtDur(clk.ef), x2, y + R + 36);"),
    # --- спагеттификация ---
    ("ctx.fillText('горизонт ' + bh.name, bx, cy + Rh + 8);", "ctx.fillText('horizon ' + bh.name, bx, cy + Rh + 8);"),
    ("inside ? 'за горизонтом' : fmtLen(rm);", "inside ? 'past the horizon' : fmtLen(rm);"),
    ("inside ? (sp.kind === 'smbh' ? 'цел, но выхода уже нет' : 'не осталось ничего целого') : da < 1 ? 'ничего не чувствует' : da < 10 ? 'тянет за ноги' : da < 1000 ? 'смертельно опасно' : 'спагетти';",
     "inside ? (sp.kind === 'smbh' ? 'intact, but trapped' : 'nothing left intact') : da < 1 ? 'feels nothing' : da < 10 ? 'legs pulled' : da < 1000 ? 'deadly' : 'spaghetti';"),
    # --- двухщелевой ---
    ("dsDet.textContent = 'Детектор у щелей: ' + (ds.det ? 'вкл' : 'выкл');", "dsDet.textContent = 'Detector at slits: ' + (ds.det ? 'on' : 'off');"),
    ("ctx.fillText('детектор', bx - bw / 2 - 18, cy - sd - sa * 2.2);", "ctx.fillText('detector', bx - bw / 2 - 18, cy - sd - sa * 2.2);"),
    ("plural(n2, ['электрон', 'электрона', 'электронов']);", "plural(n2, ['electron', 'electrons']);"),
    # --- туннель ---
    ("ctx.fillText('энергия частицы', 10, eY - 4);", "ctx.fillText('particle energy', 10, eY - 4);"),
    ("ctx.fillText('стена', X(TB + tun.wB / 2), base - bh - 4);", "ctx.fillText('wall', X(TB + tun.wB / 2), base - bh - 4);"),
    ("tun.pct == null ? 'летит к стене…' : (tun.pct * 100 < 1 ? NF1.format(Math.max(tun.pct * 100, 0.1)) : Math.round(tun.pct * 100)) + ' %';",
     "tun.pct == null ? 'heading for the wall…' : (tun.pct * 100 < 1 ? NF1.format(Math.max(tun.pct * 100, 0.1)) : Math.round(tun.pct * 100)) + '%';"),
    # --- запутанность ---
    ("'Алиса / Боб: ' + ent.log.join('  ');", "'Alice / Bob: ' + ent.log.join('  ');"),
    ("[[cx - span, 'Алиса'], [cx + span, 'Боб']]", "[[cx - span, 'Alice'], [cx + span, 'Bob']]"),
    ("ctx.fillText('источник пар', cx, cy + r * 1.6 + 10);", "ctx.fillText('pair source', cx, cy + r * 1.6 + 10);"),
    # --- календарь ---
    ("date: '1 января, 00:00', t: 'Большой взрыв', sub: '13,8 млрд лет назад'", "date: 'Jan 1, 00:00', t: 'The Big Bang', sub: '13.8 billion years ago'"),
    ("date: '1 января, 00:14', t: 'Вселенная становится прозрачной, свет этого момента мы видим как реликтовое излучение', sub: 'через 380 тыс. лет'",
     "date: 'Jan 1, 00:14', t: 'The Universe turns transparent; we still see that light as the cosmic microwave background', sub: '380,000 years in'"),
    ("date: '6 января', t: 'Загораются первые звёзды', sub: 'через ≈ 200 млн лет'", "date: 'Jan 6', t: 'The first stars light up', sub: '≈ 200 million years in'"),
    ("date: '2 сентября', t: 'Рождаются Солнце и Земля', sub: '4,6 млрд лет назад'", "date: 'Sep 2', t: 'The Sun and Earth form', sub: '4.6 billion years ago'"),
    ("date: '22 сентября', t: 'Первая жизнь на Земле', sub: '≈ 3,8 млрд лет назад'", "date: 'Sep 22', t: 'First life on Earth', sub: '≈ 3.8 billion years ago'"),
    ("date: '17 декабря', t: 'Кембрийский взрыв: появляется множество сложных животных', sub: '538 млн лет назад'",
     "date: 'Dec 17', t: 'The Cambrian explosion: complex animals appear', sub: '538 million years ago'"),
    ("date: '25 декабря', t: 'Появляются динозавры', sub: '230 млн лет назад'", "date: 'Dec 25', t: 'Dinosaurs appear', sub: '230 million years ago'"),
    ("date: '30 декабря, 06:00', t: 'Астероид уничтожает динозавров', sub: '66 млн лет назад'", "date: 'Dec 30, 06:00', t: 'An asteroid wipes out the dinosaurs', sub: '66 million years ago'"),
    ("date: '31 декабря, 21:28', t: 'Предки человека начинают ходить на двух ногах', sub: '≈ 4 млн лет назад'", "date: 'Dec 31, 21:28', t: 'Human ancestors start walking on two legs', sub: '≈ 4 million years ago'"),
    ("date: '31 декабря, 23:48', t: 'Появляется Homo sapiens', sub: '≈ 300 тыс. лет назад'", "date: 'Dec 31, 23:48', t: 'Homo sapiens appears', sub: '≈ 300,000 years ago'"),
    ("date: '23:59:33', t: 'Люди начинают заниматься земледелием', sub: '≈ 12 тыс. лет назад'", "date: '23:59:33', t: 'People start farming', sub: '≈ 12,000 years ago'"),
    ("date: '23:59:50', t: 'Строятся египетские пирамиды', sub: '≈ 4500 лет назад'", "date: '23:59:50', t: 'The Egyptian pyramids are built', sub: '≈ 4,500 years ago'"),
    ("date: '23:59:58,8', t: 'Колумб доплывает до Америки', sub: '1492 год'", "date: '23:59:58.8', t: 'Columbus reaches the Americas', sub: '1492'"),
    ("date: '23:59:59,85', t: 'Юрий Гагарин летит в космос', sub: '1961 год'", "date: '23:59:59.85', t: 'Yuri Gagarin flies to space', sub: '1961'"),
    ("mn = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];", "mn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];"),
    ("const mg = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];",
     "const mg = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];"),
    ("return (d + 1) + ' ' + mg[m];", "return mg[m] + ' ' + (d + 1);"),
    ("return '31 декабря, ' + String(Math.floor(mins / 60))", "return 'December 31, ' + String(Math.floor(mins / 60))"),
    ("return '31 декабря, 23:59:' + String(", "return 'December 31, 23:59:' + String("),
    ("const t = cal.p >= 3 ? '31 декабря, 24:00 — сейчас' : calLabel(si, f);", "const t = cal.p >= 3 ? 'December 31, 24:00, now' : calLabel(si, f);"),
    ("calBtn.textContent = on ? '❚❚ Пауза' : '▶ Смотреть'; }", "calBtn.textContent = on ? '❚❚ Pause' : '▶ Play'; }"),
    ("localStorage.setItem('gs-tab', id); } catch (e) { /* хранилище недоступно */ }", "localStorage.setItem('eh-tab', id); } catch (e) { /* storage unavailable */ }"),
    ("history.replaceState(null, '', '#' + id); } catch (e) { /* в песочнице */ } }", "history.replaceState(null, '', '#' + id); } catch (e) { /* sandboxed */ } }"),
    ("initial = localStorage.getItem('gs-tab') || 'video';", "initial = localStorage.getItem('eh-tab') || 'video';"),
]

# адреса разделов по-английски
IDS = [('dyry', 'black-holes'), ('kvanty', 'quantum'), ('vselennaya', 'universe')]


def main():
    s = SRC.read_text(encoding="utf-8")
    missing = [a[:70] for a, _ in PAIRS if a not in s]
    if missing:
        sys.exit("не найдено в kosmos/index.html:\n  " + "\n  ".join(missing))
    for a, b in PAIRS:
        s = s.replace(a, b)
    for ru, en in IDS:
        s = re.sub(rf"(?<![A-Za-z0-9_]){ru}(?![A-Za-z0-9_-])", en, s)
    # комментарии в коде: переводить не обязательно, но на английском сайте их лучше убрать
    s = re.sub(r"/\*[^*]*[А-Яа-яЁё][^*]*\*/", lambda m: "/* — */" if "\n" not in m.group(0) else m.group(0), s)
    s = re.sub(r"<!--[^>]*[А-Яа-яЁё][^>]*-->", "", s)
    left = [f"{i + 1}: {line.strip()[:110]}" for i, line in enumerate(s.splitlines()) if re.search(r"[А-Яа-яЁё]", line)]
    if left:
        sys.exit("осталась кириллица:\n  " + "\n  ".join(left))
    DOCS.mkdir(exist_ok=True)
    (DOCS / "index.html").write_text(s, encoding="utf-8")
    (DOCS / ".nojekyll").write_text("", encoding="utf-8")
    web = HERE / "video" / "web" / "en"
    if web.exists():
        (DOCS / "video").mkdir(exist_ok=True)
        for f in sorted(web.glob("event-horizon-*")):
            shutil.copy2(f, DOCS / "video" / f.name)
    print(f"docs/index.html: {len(s.splitlines())} строк")


if __name__ == "__main__":
    main()
