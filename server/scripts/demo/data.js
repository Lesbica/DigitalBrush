// Demo content for `npm run seed:demo`: artists, customers, artworks, commission requests,
// orders in progress, finished orders with reviews. All emails use the reserved example.com domain.

// painting: [title, scene, palette, ratio, category, style, format, priceUAH, description]
const ARTISTS = [
    {
        key: 'maria', name: 'Марія Орлова', email: 'maria.orlova@example.com', language: 'uk', palette: 'violet',
        availability: 'open', styles: ['Digital Realism', 'Cinematic Realism'], languages: ['Українська', 'English'],
        bio: 'Цифрова художниця з Києва. Малюю міста ввечері, коли вмикаються вікна, і тихе світло на кухнях. Комішени: портрети домашніх тварин, інтер’єрні сцени, подарункові листівки.',
        paintings: [
            ['Фіолетова година', 'city', 'violet', 'portrait', 'POSTER', 'Cinematic Realism', 'JPG', 2400, 'Пізній вечір на Подолі, намальований з пам’яті: теплі вікна, мокра бруківка й перший ліхтар.'],
            ['Нічний ринок', 'city', 'ember', 'tall', 'ARCHITECTURE', 'Digital Realism', 'PNG', 1900, 'Житній ринок за хвилину до закриття. Ліпила в Procreate за три вечори.'],
            ['Дах на Липках', 'city', 'dusk', 'wide', 'ARCHITECTURE', 'Cinematic Realism', 'JPG', 2100, 'Вид з даху на сусідні будинки у сутінках. Підійде для широкої рамки над диваном.'],
            ['Паперовий місяць', 'landscape', 'violet', 'portrait', 'BOOKS', 'Digital Realism', 'JPG', 1600, 'Ілюстрація для обкладинки збірки віршів: місяць над пагорбами Феофанії.'],
            ['Остання маршрутка', 'city', 'neon', 'tall', 'POSTER', 'Cinematic Realism', 'WEBP', 1750, 'Зупинка на Виноградарі, 23:40. Неон відбивається в калюжах.'],
            ['Світло на кухні', 'aurora', 'sand', 'square', 'POSTER', 'Digital Realism', 'JPG', 1200, 'Абстрактний етюд про ранкове світло. Друкується добре навіть на А2.'],
        ],
    },
    {
        key: 'sofia', name: 'Софія Марин', email: 'sofia.maryn@example.com', language: 'uk', palette: 'paper',
        availability: 'open', styles: ['Bauhaus, Y2K', 'Mid-Century', 'Minimalism'], languages: ['Українська', 'English', 'Polski'],
        bio: 'Графічна дизайнерка, Львів. Геометричні постери в дусі Баухаусу, айдентика для кав’ярень і невеликих брендів.',
        paintings: [
            ['Композиція №12', 'bauhaus', 'paper', 'poster', 'POSTER', 'Bauhaus, Y2K', 'PNG', 1400, 'Серія «Площі»: червоне коло, синій півмісяць і жовта смуга. Файл до 60×90 см.'],
            ['Ритм', 'bauhaus', 'paper', 'square', 'POSTER', 'Bauhaus, Y2K', 'PNG', 1100, 'Квадратний постер для невеликих стін і полиць.'],
            ['Площа Ринок', 'bauhaus', 'sand', 'poster', 'BRANDING', 'Mid-Century', 'SVG', 1800, 'Геометрична мапа львівського центру для сувенірної лінійки.'],
            ['Синя станція', 'bauhaus', 'ocean', 'poster', 'POSTER', 'Mid-Century', 'PNG', 1300, 'Постер про вокзал і очікування. Кольори — з старих квитків.'],
            ['Кава о 8:00', 'bauhaus', 'ember', 'tall', 'BRANDING', 'Minimalism', 'SVG', 2200, 'Ілюстрація для меню кав’ярні. Векторний файл, можна перефарбувати.'],
            ['Тиша', 'bauhaus', 'mint', 'square', 'POSTER', 'Minimalism', 'PNG', 950, 'Мінімалістична композиція з трьох фігур.'],
        ],
    },
    {
        key: 'dani', name: 'Dani Okafor', email: 'dani.okafor@example.com', language: 'en', palette: 'neon',
        availability: 'open', styles: ['Synthwave', 'Retro Futurism', 'Vaporwave'], languages: ['English', 'Deutsch'],
        bio: 'Berlin-based illustrator. Retro-futurist key art for indie games, album covers and streamers. Usually 2–3 weeks per piece.',
        paintings: [
            ['Neon Horizon', 'synthwave', 'neon', 'wide', 'GAMES', 'Synthwave', 'PNG', 2600, 'Title screen concept for a racing game that never shipped. 4K-ready.'],
            ['Last Arcade', 'synthwave', 'candy', 'portrait', 'ADVERTISING', 'Retro Futurism', 'PNG', 2300, 'Poster for a retro gaming night in Kreuzberg.'],
            ['Night Drive', 'synthwave', 'dusk', 'wide', 'GAMES', 'Synthwave', 'JPG', 1900, 'Loopable background for streams and music videos.'],
            ['Signal', 'city', 'neon', 'tall', 'GAMES', 'Vaporwave', 'PNG', 1700, 'A city that is mostly antennas. Part of the “Broadcast” series.'],
            ['Soft Static', 'aurora', 'candy', 'portrait', 'POSTER', 'Vaporwave', 'WEBP', 1250, 'Colour study in pink and cyan. Prints well on matte paper.'],
            ['Chrome Sunset', 'synthwave', 'violet', 'square', 'ADVERTISING', 'Retro Futurism', 'PNG', 2050, 'Album cover concept, square format, text-free.'],
        ],
    },
    {
        key: 'levko', name: 'Левко Гнатюк', email: 'levko.hnatiuk@example.com', language: 'uk', palette: 'forest',
        availability: 'open', styles: ['Minimalism', 'Aesthetic'], languages: ['Українська'],
        bio: 'Живу у Ворохті. Малюю Карпати в різну погоду, роблю обкладинки для книжок і мапи для туристичних маршрутів.',
        paintings: [
            ['Туман над Говерлою', 'landscape', 'forest', 'wide', 'BOOKS', 'Minimalism', 'JPG', 2800, 'Ранок на Чорногорі. Використана як обкладинка для збірки оповідань.'],
            ['Полонина ввечері', 'landscape', 'dusk', 'portrait', 'POSTER', 'Aesthetic', 'JPG', 2200, 'Захід сонця над полониною Пожижевська.'],
            ['Медовий вогник', 'landscape', 'ember', 'portrait', 'POSTER', 'Aesthetic', 'JPG', 1900, 'Осінь, перший вогник у колибі на схилі.'],
            ['Зелений перевал', 'landscape', 'mint', 'tall', 'BOOKS', 'Minimalism', 'JPG', 1600, 'Ілюстрація до путівника по Яблуницькому перевалу.'],
            ['Пісок і сосни', 'landscape', 'sand', 'wide', 'POSTER', 'Minimalism', 'JPG', 1500, 'Тепла палітра, яка добре виглядає в дерев’яних рамках.'],
            ['Прут навесні', 'sea', 'mint', 'portrait', 'PHOTOGRAPHY', 'Aesthetic', 'JPG', 1300, 'Річка біля Ворохти у квітні, ще з льодом під берегом.'],
        ],
    },
    {
        key: 'lena', name: 'Lena Hartmann', email: 'lena.hartmann@example.com', language: 'en', palette: 'ocean',
        availability: 'busy', styles: ['Cinematic Realism', 'Minimalism'], languages: ['English', 'Deutsch'],
        bio: 'Hamburg. Seas, horizons and the hour before sunrise. My queue is full until next month, but you can still write to me.',
        paintings: [
            ['Low Tide Sunday', 'sea', 'ocean', 'wide', 'POSTER', 'Cinematic Realism', 'JPG', 2700, 'The Elbe beach at low tide, early Sunday.'],
            ['Mint Tide', 'sea', 'mint', 'portrait', 'POSTER', 'Minimalism', 'JPG', 1500, 'A calm green sea from a ferry deck.'],
            ['Harbour Lights', 'city', 'ocean', 'wide', 'ARCHITECTURE', 'Cinematic Realism', 'JPG', 2400, 'Container cranes and their reflections at night.'],
            ['Ember Field', 'sea', 'ember', 'portrait', 'POSTER', 'Cinematic Realism', 'JPG', 2000, 'The North Sea burning orange for ten minutes.'],
            ['Grey Morning', 'sea', 'sand', 'tall', 'PHOTOGRAPHY', 'Minimalism', 'JPG', 1100, 'A study of almost nothing: fog, water, one boat.'],
        ],
    },
    {
        key: 'iryna', name: 'Ірина Ковальчук', email: 'iryna.kovalchuk@example.com', language: 'uk', palette: 'candy',
        availability: 'open', styles: ['Aesthetic', 'Dreamcore'], languages: ['Українська', 'English'],
        bio: 'Квіткові принти для тканин, упаковки й одягу. Одеса. Працюю з великими безшовними візерунками.',
        paintings: [
            ['Рожевий сад', 'botanical', 'candy', 'portrait', 'FASHION', 'Aesthetic', 'PNG', 1800, 'Принт для літньої сукні. Можу підготувати безшовну версію.'],
            ['Мальви', 'botanical', 'dusk', 'tall', 'FASHION', 'Dreamcore', 'PNG', 1600, 'Мальви з бабусиного двору, трохи як уві сні.'],
            ['Чайна церемонія', 'botanical', 'mint', 'square', 'BRANDING', 'Aesthetic', 'PNG', 2100, 'Ілюстрація для упаковки трав’яного чаю.'],
            ['Медові квіти', 'botanical', 'sand', 'portrait', 'MOCKUPS', 'Aesthetic', 'JPG', 1350, 'Пастельна композиція для листівок і банок з медом.'],
            ['Нічні півонії', 'botanical', 'violet', 'portrait', 'FASHION', 'Dreamcore', 'PNG', 1900, 'Темний варіант квіткового принту для шарфів.'],
            ['Хвиля', 'aurora', 'candy', 'wide', 'POSTER', 'Dreamcore', 'WEBP', 900, 'Фон для соцмереж і заставок.'],
        ],
    },
    {
        key: 'taras', name: 'Тарас Мельник', email: 'taras.melnyk@example.com', language: 'uk', palette: 'ember',
        availability: 'vacation', styles: ['Psychedelic Art', 'Surrealism, Neo-Psychedelia, Op Art'], languages: ['Українська'],
        bio: 'Абстракції, кольорові поля, обкладинки для електронної музики. Харків. До кінця місяця у відпустці — роботи можна купувати.',
        paintings: [
            ['Червоне поле', 'aurora', 'ember', 'portrait', 'POSTER', 'Psychedelic Art', 'JPG', 1700, 'Кольорове поле для великої стіни. Найкраще друкувати від 70 см.'],
            ['Ультрамарин', 'aurora', 'ocean', 'square', 'ADVERTISING', 'Surrealism, Neo-Psychedelia, Op Art', 'JPG', 1500, 'Обкладинка синглу, без тексту.'],
            ['Мʼята', 'aurora', 'mint', 'portrait', 'POSTER', 'Psychedelic Art', 'JPG', 1300, 'Холодна, спокійна абстракція.'],
            ['Схід', 'aurora', 'dusk', 'wide', 'POSTER', 'Psychedelic Art', 'JPG', 1450, 'Широкий формат для простору над ліжком.'],
            ['Карамель', 'aurora', 'sand', 'tall', 'POSTER', 'Surrealism, Neo-Psychedelia, Op Art', 'WEBP', 1150, 'Теплі тони, м’які переходи.'],
        ],
    },
    {
        key: 'oleksa', name: 'Олекса Бойко', email: 'oleksa.boiko@example.com', language: 'uk', palette: 'neon',
        availability: 'open', styles: ['Cyberpunk', 'Synthwave'], languages: ['Українська', 'English'],
        bio: 'Концепт-художник ігрових фонів. Кіберпанк-міста, неон, дощ. Роблю фони для стрімів і аватарки.',
        paintings: [
            ['Дощ на Позняках', 'city', 'neon', 'wide', 'GAMES', 'Cyberpunk', 'PNG', 2900, 'Концепт локації для інді-гри: житловий масив у 2087 році.'],
            ['Сигнал з Троєщини', 'city', 'violet', 'tall', 'GAMES', 'Cyberpunk', 'PNG', 2200, 'Висотки й антени, фон для стріму.'],
            ['Метро «Дніпро»', 'synthwave', 'neon', 'wide', 'GAMES', 'Synthwave', 'PNG', 1800, 'Фантазія про станцію над річкою.'],
            ['Нічна зміна', 'city', 'ember', 'portrait', 'POSTER', 'Cyberpunk', 'JPG', 1600, 'Промзона вночі, теплі вікна цехів.'],
            ['Пікселі', 'synthwave', 'candy', 'square', '2D AVATARS', 'Synthwave', 'PNG', 800, 'Квадратна заставка, підійде як аватар чи обкладинка плейлиста.'],
            ['Холодний неон', 'city', 'ocean', 'portrait', 'POSTER', 'Cyberpunk', 'JPG', 1500, 'Синя гама, мало світла, багато дощу.'],
        ],
    },
];

const CUSTOMERS = [
    { key: 'olena', name: 'Олена Коваль', email: 'olena.koval@example.com', language: 'uk', palette: 'mint' },
    { key: 'andrii', name: 'Андрій Шевчук', email: 'andrii.shevchuk@example.com', language: 'uk', palette: 'ocean' },
    { key: 'natalia', name: 'Наталія Гриценко', email: 'natalia.hrytsenko@example.com', language: 'uk', palette: 'candy' },
    { key: 'mark', name: 'Mark O’Neill', email: 'mark.oneill@example.com', language: 'en', palette: 'sand' },
    { key: 'olha', name: 'Ольга Савчук', email: 'olha.savchuk@example.com', language: 'uk', palette: 'dusk' },
    { key: 'dmytro', name: 'Дмитро Лисенко', email: 'dmytro.lysenko@example.com', language: 'uk', palette: 'violet' },
];

// Open requests on the public board.
// [customer, title, description, category, style, format, size, priceUAH, deadlineInDays, reference scene|null]
const PUBLIC_REQUESTS = [
    ['olena', 'Наш пес Бруно в образі ренесансного вельможі', 'Класичний «олійний» вигляд, темне тло, Бруно в оксамитовому камзолі. Фото пришлю в чаті. Потрібен файл для друку 40×50 см.', '2D AVATARS', 'Hyperrealism', 'PNG', '4000 × 5000 px', 2200, 30, 'aurora'],
    ['andrii', 'Обкладинка для інді-фолк альбому', 'Квадрат 3000 px. Ліс на світанку, маленька хата, теплі вогники. Без тексту — назву додамо самі.', 'POSTER', 'Minimalism', 'PSD', '3000 × 3000 px', 3500, 21, 'landscape'],
    ['natalia', 'Акварель місця нашого весілля', 'Садиба під Києвом, фото з різних ракурсів є. Хочемо подарувати батькам на річницю.', 'SKETCH', 'Aesthetic', 'JPG', 'A3', 1800, 40, null],
    ['mark', 'Key art for a cozy farming game', 'Wide hero image for our Steam page: valley, small farm, autumn colours. Style references attached.', 'GAMES', 'Aesthetic', 'PNG', '3840 × 2160 px', 6000, 45, 'landscape'],
    ['olha', 'Логотип і стиль для кав’ярні «Зерно»', 'Невелика кав’ярня в Житомирі. Потрібні логотип, кольори й два шаблони для інстаграму.', 'BRANDING', 'Minimalism', 'AI', 'Вектор', 4500, 28, 'bauhaus'],
    ['dmytro', 'Аватар для Twitch-каналу в аніме-стилі', 'Хлопець у навушниках, фіолетово-бірюзові кольори, кіт на плечі.', 'ANIME', 'Dreamcore', 'PNG', '1000 × 1000 px', 900, 14, null],
    ['olena', 'Ілюстрація до дитячої книжки про їжачка', 'Одна розворотна ілюстрація: їжачок збирає яблука в саду. Можливе продовження на всю книжку.', 'BOOKS', 'Aesthetic', 'PSD', '2 × A4', 2800, 35, 'botanical'],
    ['mark', 'Set of 24 app icons, soft 3D look', 'Icons for a budgeting app: wallet, chart, piggy bank, etc. Figma file with components.', 'ICONS', 'Minimalism', 'Figma', '512 × 512 px', 3200, 30, null],
    ['andrii', 'Постер для джазового фестивалю у Львові', 'Формат B1, геометрія в дусі Баухаусу, місце для дат і лайнапу.', 'POSTER', 'Bauhaus, Y2K', 'AI', 'B1', 2500, 20, 'bauhaus'],
    ['natalia', 'Мокап упаковки трав’яного чаю', 'Три смаки: м’ята, липа, чебрець. Потрібна ілюстрація й мокап коробки.', 'MOCKUPS', 'Mid-Century', 'PSD', '3 SKU', 1500, 25, 'botanical'],
];

// Orders that are already being worked on / finished.
// chat: [from 'c'|'a', text] lines before the stage submissions
const ORDERS = [
    {
        customer: 'olena', artist: 'maria', status: 'Color', review: 'pending', price: 2400, daysAgo: 12,
        title: 'Портрет нашої кішки Луни біля вікна', category: '2D AVATARS', style: 'Digital Realism', format: 'PNG', size: '3000 × 3750 px',
        description: 'Луна сидить на підвіконні, за вікном вечірній Київ. Хочеться теплого світла, як у ваших міських роботах.',
        scene: 'city', palette: 'violet',
        chat: [['c', 'Добрий вечір! Надіслала фото Луни, вона сіра з білими лапками.'], ['a', 'Дякую! Зроблю ескіз з видом на Поділ, підійде?'], ['c', 'Так, ідеально 🙂'], ['a', 'Ось лайнарт, перевірте пропорції морди.']],
    },
    {
        customer: 'mark', artist: 'dani', status: 'Lineart', review: 'none', price: 3800, daysAgo: 6,
        title: 'Cover art for a synthwave EP', category: 'ADVERTISING', style: 'Synthwave', format: 'PNG', size: '3000 × 3000 px',
        description: 'Four-track EP called “Night Shift”. Car on an empty highway, big sun, grid. No text.',
        scene: 'synthwave', palette: 'neon',
        chat: [['c', 'Hi Dani! Loved your Neon Horizon piece, something in that direction.'], ['a', 'Great, I’ll start with a sketch of the composition.'], ['c', 'Sketch looks great, go ahead!']],
    },
    {
        customer: 'olha', artist: 'sofia', status: 'Sketch', review: 'pending', price: 4200, daysAgo: 3,
        title: 'Серія з трьох постерів для кав’ярні', category: 'POSTER', style: 'Bauhaus, Y2K', format: 'AI', size: '50 × 70 см',
        description: 'Три постери в одному стилі: кава, круасан, чашка. Кольори — теракота, синій, кремовий.',
        scene: 'bauhaus', palette: 'paper',
        chat: [['c', 'Привіт! Кольори з логотипа скинула файлом.'], ['a', 'Отримала, надсилаю перші ескізи.']],
    },
    {
        customer: 'dmytro', artist: 'oleksa', status: 'Final', review: 'pending', price: 2600, daysAgo: 18,
        title: 'Фон для стріму: нічне місто', category: 'GAMES', style: 'Cyberpunk', format: 'PNG', size: '1920 × 1080 px',
        description: 'Широкий фон для «Just chatting»: місто під дощем, неонові вивіски, місце для вебкамери праворуч.',
        scene: 'city', palette: 'neon',
        chat: [['c', 'Здоров! Можна вивіску з назвою каналу «LYS»?'], ['a', 'Так, додам на будинок ліворуч.'], ['c', 'Вогонь, кольори супер.'], ['a', 'Фінальна версія, вивіску зробив трохи яскравішою.']],
    },
    // finished, with a review
    {
        customer: 'natalia', artist: 'levko', status: 'Completed', price: 3000, daysAgo: 60, rating: 5,
        review_text: 'Левко зробив обкладинку швидше, ніж обіцяв, і двічі безкоштовно правив кольори. Видавництво в захваті.',
        title: 'Карпатський світанок для обкладинки книжки', category: 'BOOKS', style: 'Minimalism', format: 'PSD', size: '2480 × 3508 px',
        description: 'Обкладинка для збірки оповідань про Гуцульщину.', scene: 'landscape', palette: 'forest',
        chat: [['c', 'Дякую, остаточна версія чудова!']],
    },
    {
        customer: 'andrii', artist: 'lena', status: 'Completed', price: 3400, daysAgo: 45, rating: 5,
        review_text: 'Lena understood exactly what we wanted. The print hangs in our living room now.',
        title: 'Sea at dawn for our living room', category: 'POSTER', style: 'Cinematic Realism', format: 'JPG', size: '6000 × 4000 px',
        description: 'Wide calm sea, first light, a small boat. Print size 120 × 80 cm.', scene: 'sea', palette: 'ocean',
        chat: [['c', 'Thank you, Lena!']],
    },
    {
        customer: 'olena', artist: 'iryna', status: 'Completed', price: 2300, daysAgo: 38, rating: 4,
        review_text: 'Дуже гарний принт, сукню вже пошили. Мінус одна зірка — затримка на кілька днів, але Ірина попередила заздалегідь.',
        title: 'Квітковий принт для літньої сукні', category: 'FASHION', style: 'Aesthetic', format: 'PNG', size: 'Безшовний 60 × 60 см',
        description: 'Дрібні рожеві квіти на кремовому тлі.', scene: 'botanical', palette: 'candy',
        chat: [['c', 'Отримала файл, дякую!']],
    },
    {
        customer: 'mark', artist: 'maria', status: 'Completed', price: 2600, daysAgo: 25, rating: 5,
        review_text: 'A perfect gift for a friend who moved away from Kyiv. Maria even added the window of his old flat.',
        title: 'Kyiv at night, a gift for a friend', category: 'POSTER', style: 'Cinematic Realism', format: 'JPG', size: '50 × 70 cm',
        description: 'Podil at night seen from Andriivskyi descent.', scene: 'city', palette: 'dusk',
        chat: [['c', 'He loved it. Thanks a lot!']],
    },
    {
        customer: 'dmytro', artist: 'dani', status: 'Completed', price: 1500, daysAgo: 70, rating: 5,
        review_text: 'Аватар топ, підписники питають, хто малював 🙂',
        title: 'Аватар у стилі ретро-футуризм', category: '2D AVATARS', style: 'Retro Futurism', format: 'PNG', size: '1000 × 1000 px',
        description: 'Мій портрет у шоломі пілота на тлі неонового сонця.', scene: 'synthwave', palette: 'candy',
        chat: [['c', 'Дякую, бро!']],
    },
    // waiting for the artist to accept, declined, cancelled
    {
        customer: 'olha', artist: 'levko', status: 'Open', price: 2000, daysAgo: 1,
        title: 'Акварельна мапа нашого села', category: 'SKETCH', style: 'Aesthetic', format: 'JPG', size: 'A2',
        description: 'Село Микуличин: річка, церква, наша вулиця. Для подарунка тату на 60-річчя.', scene: null, palette: 'forest', chat: [],
    },
    {
        customer: 'mark', artist: 'iryna', status: 'Open', price: 2700, daysAgo: 2,
        title: 'Floral pattern for a tea brand', category: 'BRANDING', style: 'Aesthetic', format: 'AI', size: 'Seamless tile',
        description: 'Chamomile and mint, soft greens. For packaging and the website.', scene: 'botanical', palette: 'mint', chat: [],
    },
    {
        customer: 'dmytro', artist: 'lena', status: 'Declined', price: 1200, daysAgo: 9,
        title: 'Морський пейзаж за два дні', category: 'POSTER', style: 'Minimalism', format: 'JPG', size: 'A3',
        description: 'Терміново, до суботи.', scene: null, palette: 'ocean', chat: [],
    },
];

const PURCHASES = [
    ['olena', 'Фіолетова година'], ['olena', 'Рожевий сад'],
    ['andrii', 'Туман над Говерлою'], ['andrii', 'Композиція №12'],
    ['natalia', 'Мальви'], ['natalia', 'Mint Tide'],
    ['mark', 'Neon Horizon'], ['mark', 'Площа Ринок'], ['mark', 'Червоне поле'],
    ['olha', 'Кава о 8:00'], ['dmytro', 'Дощ на Позняках'], ['dmytro', 'Night Drive'],
];

module.exports = { ARTISTS, CUSTOMERS, PUBLIC_REQUESTS, ORDERS, PURCHASES };
