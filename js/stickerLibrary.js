// StickerLibrary — Sprint 6.6: Sticker Studio catalog.
//
// Architecture goals (per spec):
//   * Folder-based packs so adding a new sticker category later means
//     dropping new entries into a registry, never touching any other code.
//   * Each sticker carries crisp, scalable artwork (SVG) so children can
//     resize stickers naturally without seeing pixelation.
//   * Every entry has a friendly name + searchable keywords. The grid
//     never shows filenames, IDs, or any technical noise.
//   * The library is data only — no DOM, no rendering. StickerStudio
//     owns the UI; SlideRenderer owns the canvas; SceneEngine owns the
//     mutations.
const StickerLibrary=(function(){
  // Category order is the order children see in the sidebar.
  // Favorites + Recent are virtual: they don't ship with stickers; they
  // collect references from localStorage at runtime.
  const CATEGORIES=[
    {id:'favorites',     label:'Favorites',     emoji:'⭐', virtual:true},
    {id:'recents',       label:'Recent',        emoji:'🕐', virtual:true},
    {id:'characters',    label:'Characters',    emoji:'🙂'},
    {id:'animals',       label:'Animals',       emoji:'🐶'},
    {id:'nature',        label:'Nature',        emoji:'🌳'},
    {id:'buildings',     label:'Buildings',     emoji:'🏠'},
    {id:'vehicles',      label:'Vehicles',      emoji:'🚗'},
    {id:'food',          label:'Food',          emoji:'🍎'},
    {id:'space',         label:'Space',         emoji:'🪐'},
    {id:'fantasy',       label:'Fantasy',       emoji:'🧚'},
    {id:'celebrations',  label:'Celebrations',  emoji:'🎉'},
    {id:'school',        label:'School',        emoji:'🏫'},
    {id:'sports',        label:'Sports',        emoji:'⚽'},
    {id:'weather',       label:'Weather',       emoji:'☀'},
    {id:'emotions',      label:'Emotions',      emoji:'❤️'},
    {id:'decorations',   label:'Decorations',   emoji:'✨'}
  ];

  // SVG builders. Every sticker is a 200×200 viewBox so resizing is a
  // single transform. The emoji `glyph` IS the sticker — Sprint 6.6.1
  // drops the pastel disc + white ring so artwork reads on its own,
  // with full transparency. A subtle drop shadow keeps the sticker
  // feeling lifted off the page. The legacy `bg` argument stays in the
  // signature so the catalog table doesn't need a sweeping rewrite.
  function _sticker(glyph,bg){
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">'+
      '<defs>'+
        '<filter id="s" x="-20%" y="-20%" width="140%" height="140%">'+
          '<feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-opacity="0.22"/>'+
        '</filter>'+
      '</defs>'+
      '<text x="100" y="158" text-anchor="middle" font-size="170" '+
        'font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif" '+
        'filter="url(#s)">'+
        glyph+
      '</text>'+
      '</svg>'
    );
  }

  // Every entry: id, category, name, keywords, svg.
  // Keep keywords short, child-words only (no design jargon).
  function _S(id,category,name,glyph,bg,keywords){
    return {
      id:category+'.'+id,
      category:category,
      name:name,
      keywords:keywords||[],
      glyph:glyph,
      svg:_sticker(glyph,bg)
    };
  }

  const STICKERS=[
    // ---- Characters ----
    _S('boy',          'characters','Boy',          '👦','#FFD9B5',['kid','child','boy','friend']),
    _S('girl',         'characters','Girl',         '👧','#FFC1D9',['kid','child','girl','friend']),
    _S('baby',         'characters','Baby',         '👶','#FFE2C0',['baby','infant','tiny']),
    _S('mom',          'characters','Mom',          '👩','#FFCBC4',['mom','mother','parent','grown up']),
    _S('dad',          'characters','Dad',          '👨','#BFD9F2',['dad','father','parent','grown up']),
    _S('grandma',      'characters','Grandma',      '👵','#E2C6F2',['grandma','granny','nana']),
    _S('grandpa',      'characters','Grandpa',      '👴','#D7D3C2',['grandpa','grandad']),
    _S('superhero',    'characters','Superhero',    '🦸','#FFB199',['hero','super','cape']),
    _S('princess',     'characters','Princess',     '👸','#F8B4D8',['princess','crown','royal']),
    _S('prince',       'characters','Prince',       '🤴','#B6C9F0',['prince','crown','royal']),
    _S('wizard',       'characters','Wizard',       '🧙','#C5B4F0',['wizard','magic','spell']),
    _S('astronaut',    'characters','Astronaut',    '🧑‍🚀','#BFE0FF',['astronaut','space','suit']),
    _S('ninja',        'characters','Ninja',        '🥷','#C7C7CC',['ninja','sneaky']),
    _S('detective',    'characters','Detective',    '🕵️','#D6C5A8',['detective','spy','mystery']),

    // ---- Animals ----
    _S('cat',          'animals','Cat',          '🐱','#FFD9A8',['cat','kitty','meow','pet']),
    _S('dog',          'animals','Dog',          '🐶','#FFDFA8',['dog','puppy','woof','pet']),
    _S('rabbit',       'animals','Rabbit',       '🐰','#FFDDEE',['bunny','rabbit','hop']),
    _S('bear',         'animals','Bear',         '🐻','#D6B58A',['bear','teddy']),
    _S('panda',        'animals','Panda',        '🐼','#E8E8E8',['panda','bear']),
    _S('lion',         'animals','Lion',         '🦁','#F2C865',['lion','king','roar']),
    _S('tiger',        'animals','Tiger',        '🐯','#FFB661',['tiger','wild','roar']),
    _S('monkey',       'animals','Monkey',       '🐵','#C9A079',['monkey','ape','banana']),
    _S('elephant',     'animals','Elephant',     '🐘','#C7D1DA',['elephant','big','trunk']),
    _S('giraffe',      'animals','Giraffe',      '🦒','#F5D78A',['giraffe','tall','neck']),
    _S('zebra',        'animals','Zebra',        '🦓','#E2E2E2',['zebra','stripes']),
    _S('horse',        'animals','Horse',        '🐴','#D6B17B',['horse','pony','gallop']),
    _S('cow',          'animals','Cow',          '🐮','#FFEAD0',['cow','moo','farm']),
    _S('pig',          'animals','Pig',          '🐷','#FFC4D9',['pig','oink','farm']),
    _S('chicken',      'animals','Chicken',      '🐔','#FFE7AC',['chicken','hen','farm','bird']),
    _S('duck',         'animals','Duck',         '🦆','#FFE48C',['duck','quack','pond']),
    _S('owl',          'animals','Owl',          '🦉','#D8C5A2',['owl','hoot','wise']),
    _S('penguin',      'animals','Penguin',      '🐧','#BFD1E0',['penguin','ice','bird']),
    _S('fish',         'animals','Fish',         '🐠','#A9DEEF',['fish','sea','swim']),
    _S('whale',        'animals','Whale',        '🐳','#B0CCE4',['whale','ocean','big']),
    _S('dolphin',      'animals','Dolphin',      '🐬','#B5D8EA',['dolphin','sea','swim']),
    _S('octopus',      'animals','Octopus',      '🐙','#F2A1A1',['octopus','sea','arms']),
    _S('butterfly',    'animals','Butterfly',    '🦋','#C9B6F5',['butterfly','wings','bug']),
    _S('bee',          'animals','Bee',          '🐝','#FFE17A',['bee','buzz','honey']),
    _S('ladybug',      'animals','Ladybug',      '🐞','#FFB7B0',['ladybug','bug','spots']),
    _S('frog',         'animals','Frog',         '🐸','#BCE2B0',['frog','pond','jump']),
    _S('dragon',       'animals','Dragon',       '🐲','#A9D38F',['dragon','fire','wings']),
    _S('dinosaur',     'animals','Dinosaur',     '🦖','#B0DCC0',['dinosaur','dino','t-rex']),
    _S('unicorn',      'animals','Unicorn',      '🦄','#F2C8E8',['unicorn','horn','magic']),

    // ---- Nature ----
    _S('tree',         'nature','Tree',         '🌳','#BFE2A8',['tree','forest','plant']),
    _S('pine',         'nature','Pine',         '🌲','#A8D6A1',['pine','tree','evergreen']),
    _S('palm',         'nature','Palm',         '🌴','#BFDF98',['palm','tree','beach']),
    _S('cactus',       'nature','Cactus',       '🌵','#A8CFA0',['cactus','desert','plant']),
    _S('flower',       'nature','Flower',       '🌸','#FFC9DC',['flower','blossom','spring']),
    _S('rose',         'nature','Rose',         '🌹','#FFB0B0',['rose','flower','red']),
    _S('sunflower',    'nature','Sunflower',    '🌻','#FFE283',['sunflower','flower','yellow']),
    _S('tulip',        'nature','Tulip',        '🌷','#FFC9C0',['tulip','flower']),
    _S('leaf',         'nature','Leaf',         '🍃','#C7E9B0',['leaf','green','plant']),
    _S('mountain',     'nature','Mountain',     '⛰️','#C5C7CC',['mountain','hill','peak']),
    _S('volcano',      'nature','Volcano',      '🌋','#E0A285',['volcano','lava']),
    _S('rock',         'nature','Rock',         '🪨','#C6C2BC',['rock','stone']),
    _S('water-drop',   'nature','Water Drop',   '💧','#BFE6F2',['water','drop','rain']),
    _S('fire',         'nature','Fire',         '🔥','#FFB07A',['fire','flame','hot']),
    _S('rainbow',      'nature','Rainbow',      '🌈','#FFDDA8',['rainbow','colors','sky']),
    _S('mushroom',     'nature','Mushroom',     '🍄','#F5BFC4',['mushroom','toadstool']),

    // ---- Buildings ----
    _S('house',        'buildings','House',        '🏠','#FFDDB5',['house','home']),
    _S('barn',         'buildings','Barn',         '🏚️','#E8C0A0',['barn','farm','old']),
    _S('school',       'buildings','School',       '🏫','#F2D5A8',['school','class']),
    _S('castle',       'buildings','Castle',       '🏰','#D6C5E8',['castle','royal','fairy']),
    _S('tent',         'buildings','Tent',         '⛺','#FFD7A0',['tent','camp']),
    _S('hut',          'buildings','Hut',          '🛖','#E0C8A0',['hut','cabin']),
    _S('church',       'buildings','Church',       '⛪','#E0DDD2',['church','steeple']),
    _S('hospital',     'buildings','Hospital',     '🏥','#FFC7C2',['hospital','doctor']),
    _S('skyscraper',   'buildings','Tall Building','🏢','#C7D2E0',['building','city']),
    _S('factory',      'buildings','Factory',      '🏭','#C0C6CC',['factory','plant']),
    _S('shop',         'buildings','Shop',         '🏪','#D6E5F2',['shop','store']),
    _S('lighthouse',   'buildings','Lighthouse',   '🗼','#FFC8B0',['lighthouse','tower']),
    _S('bridge',       'buildings','Bridge',       '🌉','#C0CFE0',['bridge','crossing']),

    // ---- Vehicles ----
    _S('car',          'vehicles','Car',          '🚗','#FFB7B7',['car','drive','auto']),
    _S('taxi',         'vehicles','Taxi',         '🚕','#FFE07A',['taxi','cab','car']),
    _S('bus',          'vehicles','Bus',          '🚌','#FFC766',['bus','ride']),
    _S('truck',        'vehicles','Truck',        '🚚','#FFCBAE',['truck','delivery']),
    _S('police',       'vehicles','Police Car',   '🚓','#B0C4E0',['police','car','siren']),
    _S('ambulance',    'vehicles','Ambulance',    '🚑','#FFB6B6',['ambulance','rescue']),
    _S('fire-engine',  'vehicles','Fire Engine',  '🚒','#FF9999',['fire','truck','engine']),
    _S('tractor',      'vehicles','Tractor',      '🚜','#A8D88A',['tractor','farm']),
    _S('bike',         'vehicles','Bike',         '🚲','#B5D5EA',['bike','bicycle','ride']),
    _S('scooter',      'vehicles','Scooter',      '🛴','#D0E0EC',['scooter','ride']),
    _S('motorbike',    'vehicles','Motorbike',    '🏍️','#C9C9C9',['motorbike','motorcycle']),
    _S('train',        'vehicles','Train',        '🚂','#B5B0A8',['train','choo']),
    _S('plane',        'vehicles','Plane',        '✈️','#BFD8EE',['plane','fly','jet']),
    _S('helicopter',   'vehicles','Helicopter',   '🚁','#C8D2E0',['helicopter','fly']),
    _S('boat',         'vehicles','Boat',         '⛵','#B0D0E5',['boat','sail','sea']),
    _S('ship',         'vehicles','Ship',         '🚢','#B7C8DE',['ship','boat','sea']),
    _S('rocket',       'vehicles','Rocket',       '🚀','#D0BFEA',['rocket','space','blast']),

    // ---- Food ----
    _S('apple',        'food','Apple',        '🍎','#FFB7B7',['apple','fruit','red']),
    _S('banana',       'food','Banana',       '🍌','#FFE787',['banana','fruit','yellow']),
    _S('grapes',       'food','Grapes',       '🍇','#D5BFEA',['grapes','fruit']),
    _S('orange',       'food','Orange',       '🍊','#FFC987',['orange','fruit']),
    _S('strawberry',   'food','Strawberry',   '🍓','#FFB0B0',['strawberry','berry','fruit']),
    _S('watermelon',   'food','Watermelon',   '🍉','#FFB7B0',['watermelon','fruit']),
    _S('pineapple',    'food','Pineapple',    '🍍','#FFE07A',['pineapple','fruit']),
    _S('cherry',       'food','Cherry',       '🍒','#FFA6A6',['cherry','fruit']),
    _S('lemon',        'food','Lemon',        '🍋','#FFEC8A',['lemon','fruit','sour']),
    _S('peach',        'food','Peach',        '🍑','#FFC9B0',['peach','fruit']),
    _S('avocado',      'food','Avocado',      '🥑','#C4DFA0',['avocado','fruit']),
    _S('carrot',       'food','Carrot',       '🥕','#FFB78A',['carrot','vegetable']),
    _S('corn',         'food','Corn',         '🌽','#FFE17A',['corn','vegetable']),
    _S('broccoli',     'food','Broccoli',     '🥦','#B8DAA8',['broccoli','vegetable']),
    _S('pizza',        'food','Pizza',        '🍕','#FFCFA8',['pizza','slice','food']),
    _S('burger',       'food','Burger',       '🍔','#FFCC88',['burger','hamburger','food']),
    _S('hot-dog',      'food','Hot Dog',      '🌭','#FFC499',['hot dog','food']),
    _S('fries',        'food','Fries',        '🍟','#FFE08A',['fries','chips','food']),
    _S('sandwich',     'food','Sandwich',     '🥪','#FFD9A0',['sandwich','food']),
    _S('bread',        'food','Bread',        '🍞','#FFD9A0',['bread','loaf']),
    _S('cheese',       'food','Cheese',       '🧀','#FFE07A',['cheese','dairy']),
    _S('egg',          'food','Egg',          '🥚','#FFF4DD',['egg','breakfast']),
    _S('ice-cream',    'food','Ice Cream',    '🍦','#FFD9E8',['ice cream','dessert']),
    _S('cookie',       'food','Cookie',       '🍪','#E8C5A0',['cookie','treat']),
    _S('donut',        'food','Donut',        '🍩','#FFC0DD',['donut','sweet']),
    _S('candy',        'food','Candy',        '🍬','#FFB6CF',['candy','sweet']),
    _S('lollipop',     'food','Lollipop',     '🍭','#FFB6E0',['lollipop','candy']),
    _S('chocolate',    'food','Chocolate',    '🍫','#C7906A',['chocolate','sweet']),
    _S('milk',         'food','Milk',         '🥛','#F2F2F2',['milk','drink']),
    _S('juice',        'food','Juice',        '🧃','#FFC9A0',['juice','drink','box']),

    // ---- Space ----
    _S('sun',          'space','Sun',          '☀','#FFE17A',['sun','star','bright']),
    _S('moon',         'space','Moon',         '🌙','#D8D8E8',['moon','night','crescent']),
    _S('full-moon',    'space','Full Moon',    '🌕','#F2EAB0',['moon','full','night']),
    _S('earth',        'space','Earth',        '🌍','#A8D2A0',['earth','planet','globe']),
    _S('saturn',       'space','Planet',       '🪐','#C9B6E8',['planet','saturn','rings']),
    _S('star',         'space','Star',         '⭐','#FFE17A',['star','sparkle']),
    _S('shooting-star','space','Shooting Star','🌠','#C9B6E8',['shooting','star','wish']),
    _S('comet',        'space','Comet',        '☄️','#FFC089',['comet','tail']),
    _S('rocket-space', 'space','Rocket',       '🚀','#D0BFEA',['rocket','space']),
    _S('ufo',          'space','UFO',          '🛸','#C5E0E8',['ufo','alien','spaceship']),
    _S('alien',        'space','Alien',        '👽','#B0E5C0',['alien','space','green']),
    _S('milky-way',    'space','Galaxy',       '🌌','#A9A0E8',['galaxy','space','milky']),
    _S('telescope',    'space','Telescope',    '🔭','#B7BFCC',['telescope','look','stars']),
    _S('satellite',    'space','Satellite',    '🛰️','#C9D2E0',['satellite','orbit']),

    // ---- Fantasy ----
    _S('fairy',        'fantasy','Fairy',        '🧚','#F2B8E5',['fairy','wings','magic']),
    _S('mermaid',      'fantasy','Mermaid',      '🧜‍♀️','#A9D5EA',['mermaid','sea']),
    _S('wizard-fantasy','fantasy','Wizard',      '🧙‍♂️','#C5B4F0',['wizard','magic','hat']),
    _S('unicorn-fantasy','fantasy','Unicorn',    '🦄','#F2C8E8',['unicorn','horn','magic']),
    _S('dragon-fantasy','fantasy','Dragon',      '🐉','#A9D38F',['dragon','fire','wings']),
    _S('genie',        'fantasy','Genie',        '🧞','#C5D5F2',['genie','wish','magic']),
    _S('elf',          'fantasy','Elf',          '🧝','#BFE0BF',['elf','pointy','ears']),
    _S('vampire',      'fantasy','Vampire',      '🧛','#D2B5D2',['vampire','spooky']),
    _S('ghost',        'fantasy','Ghost',        '👻','#E0E5F2',['ghost','spooky','boo']),
    _S('crystal-ball', 'fantasy','Crystal Ball', '🔮','#C5B4F0',['crystal','ball','magic']),
    _S('magic-wand',   'fantasy','Magic Wand',   '🪄','#F2E0A8',['wand','magic','sparkle']),
    _S('sparkles',     'fantasy','Sparkles',    '✨','#FFEEC9',['sparkle','shine','magic']),
    _S('crown',        'fantasy','Crown',        '👑','#FFE17A',['crown','king','queen']),
    _S('treasure',     'fantasy','Treasure',     '💎','#A9D5EA',['gem','diamond','treasure']),
    _S('castle-fantasy','fantasy','Castle',      '🏰','#D6C5E8',['castle','royal']),

    // ---- Celebrations ----
    _S('cake',         'celebrations','Cake',         '🎂','#FFC0DD',['cake','birthday']),
    _S('party-pop',    'celebrations','Party Popper', '🎉','#FFB8B8',['party','confetti']),
    _S('balloon',      'celebrations','Balloon',      '🎈','#FF9C9C',['balloon','party']),
    _S('gift',         'celebrations','Gift',         '🎁','#FFB6C9',['gift','present']),
    _S('party-hat',    'celebrations','Party Hat',    '🥳','#FFD27A',['party','hat']),
    _S('confetti',     'celebrations','Confetti',     '🎊','#FFC080',['confetti','party']),
    _S('fireworks',    'celebrations','Fireworks',    '🎆','#FFB8E0',['fireworks','sparkle']),
    _S('birthday-candle','celebrations','Candle',     '🕯️','#FFE5A8',['candle','flame']),
    _S('ribbon',       'celebrations','Ribbon',       '🎀','#FFAFD2',['ribbon','bow']),
    _S('trophy',       'celebrations','Trophy',       '🏆','#FFE17A',['trophy','win']),
    _S('medal',        'celebrations','Medal',        '🏅','#FFC885',['medal','award']),
    _S('christmas-tree','celebrations','Christmas Tree','🎄','#A8D8A0',['christmas','tree']),
    _S('jack-o-lantern','celebrations','Pumpkin',     '🎃','#FFAC6E',['halloween','pumpkin']),

    // ---- School ----
    _S('backpack',     'school','Backpack',     '🎒','#FFC1A8',['backpack','school','bag']),
    _S('pencil',       'school','Pencil',       '✏️','#FFD27A',['pencil','write']),
    _S('crayon',       'school','Crayon',       '🖍️','#FFB6B0',['crayon','color']),
    _S('paintbrush',   'school','Paintbrush',   '🖌️','#A9D2E0',['brush','paint']),
    _S('book',         'school','Book',         '📖','#C0D5E0',['book','read']),
    _S('books',        'school','Books',        '📚','#FFAEA8',['books','library']),
    _S('notebook',     'school','Notebook',     '📓','#A8C2E0',['notebook','write']),
    _S('graduation',   'school','Graduation',   '🎓','#C7C2D9',['graduation','cap']),
    _S('alphabet',     'school','Alphabet',     '🔤','#FFE07A',['alphabet','letters']),
    _S('abacus',       'school','Abacus',       '🧮','#FFC8A0',['abacus','math','count']),
    _S('globe',        'school','Globe',        '🌐','#A8D8EA',['globe','earth','world']),
    _S('microscope',   'school','Microscope',   '🔬','#C7D2E0',['microscope','science']),
    _S('test-tube',    'school','Test Tube',    '🧪','#A0E2D2',['test','science','tube']),
    _S('ruler',        'school','Ruler',        '📏','#FFE07A',['ruler','measure']),
    _S('scissors',     'school','Scissors',     '✂️','#C9C9D2',['scissors','cut']),

    // ---- Sports ----
    _S('soccer',       'sports','Soccer Ball',  '⚽','#E8E8E8',['soccer','ball','football']),
    _S('basketball',   'sports','Basketball',   '🏀','#FFC489',['basketball','ball','hoop']),
    _S('baseball',     'sports','Baseball',     '⚾','#F2EFE2',['baseball','ball']),
    _S('football',     'sports','Football',     '🏈','#D4A37C',['football','ball']),
    _S('tennis',       'sports','Tennis',       '🎾','#D4E29A',['tennis','ball']),
    _S('volleyball',   'sports','Volleyball',   '🏐','#FFEAC9',['volleyball','ball']),
    _S('cricket',      'sports','Cricket',      '🏏','#D9C5A8',['cricket','bat']),
    _S('hockey',       'sports','Hockey',       '🏒','#C7D5E0',['hockey','stick']),
    _S('skateboard',   'sports','Skateboard',   '🛹','#C9C9C9',['skateboard','ride']),
    _S('roller-skate', 'sports','Roller Skate', '🛼','#FFB6CF',['skate','roller']),
    _S('swim',         'sports','Swim',         '🏊','#A9D2E0',['swim','swimmer','pool']),
    _S('runner',       'sports','Runner',       '🏃','#FFC799',['run','runner','race']),
    _S('cyclist',      'sports','Cyclist',      '🚴','#B5D5EA',['cycle','cyclist','bike']),
    _S('skier',        'sports','Skier',        '⛷️','#D5E5F2',['ski','skier','snow']),
    _S('weight',       'sports','Weight',       '🏋️','#C7CCD2',['weight','lift','gym']),

    // ---- Weather ----
    _S('sun-weather',  'weather','Sunny',       '☀','#FFE17A',['sun','sunny','bright']),
    _S('cloud',        'weather','Cloud',       '☁️','#E2E8F2',['cloud','cloudy']),
    _S('partly-sunny', 'weather','Partly Sunny','⛅','#FFE5B5',['partly','sunny','cloudy']),
    _S('rain',         'weather','Rain',        '🌧️','#B5C7E0',['rain','rainy','drops']),
    _S('snow',         'weather','Snow',        '❄️','#D8EAF2',['snow','snowy','cold']),
    _S('snowman',      'weather','Snowman',     '⛄','#E8F2FA',['snowman','snow','winter']),
    _S('lightning',    'weather','Lightning',   '⚡','#FFE17A',['lightning','bolt','storm']),
    _S('storm',        'weather','Storm',       '⛈️','#A8B7CC',['storm','rain','lightning']),
    _S('tornado',      'weather','Tornado',     '🌪️','#B5BFCC',['tornado','storm']),
    _S('rainbow-weather','weather','Rainbow',   '🌈','#FFDDA8',['rainbow','sky']),
    _S('wind',         'weather','Wind',        '🌬️','#C5D8E0',['wind','windy','breeze']),
    _S('umbrella',     'weather','Umbrella',    '☂️','#FFB7C7',['umbrella','rain']),
    _S('thermometer',  'weather','Thermometer', '🌡️','#FFC0C0',['thermometer','hot','cold']),

    // ---- Emotions ----
    _S('happy',        'emotions','Happy',        '😊','#FFE17A',['happy','smile','joy']),
    _S('laugh',        'emotions','Laughing',     '😂','#FFE07A',['laugh','funny','haha']),
    _S('love',         'emotions','In Love',      '😍','#FFB0BD',['love','heart','adore']),
    _S('wink',         'emotions','Wink',         '😉','#FFE07A',['wink','funny']),
    _S('sad',          'emotions','Sad',          '😢','#B5D2EA',['sad','cry','tear']),
    _S('angry',        'emotions','Angry',        '😠','#FF9C9C',['angry','mad']),
    _S('surprised',    'emotions','Surprised',    '😲','#FFD89A',['surprised','wow']),
    _S('sleepy',       'emotions','Sleepy',       '😴','#B5D2EA',['sleepy','sleep','tired']),
    _S('cool',         'emotions','Cool',         '😎','#A8D8EA',['cool','sunglasses']),
    _S('silly',        'emotions','Silly',        '🤪','#FFE17A',['silly','funny']),
    _S('hug',          'emotions','Hug',          '🤗','#FFE0B5',['hug','love']),
    _S('thinking',     'emotions','Thinking',     '🤔','#FFE0B5',['think','thinking']),
    _S('heart',        'emotions','Heart',        '❤️','#FFB0B0',['heart','love']),
    _S('broken-heart', 'emotions','Broken Heart', '💔','#FF9C9C',['broken','heart','sad']),
    _S('sparkle-heart','emotions','Sparkle Heart','💖','#FFC0DD',['sparkle','heart','love']),
    _S('two-hearts',   'emotions','Two Hearts',   '💕','#FFB7CC',['hearts','love']),
    _S('star-eyes',    'emotions','Star Eyes',    '🤩','#FFE17A',['star','excited','wow']),
    _S('peace',        'emotions','Peace',        '✌️','#FFD9B5',['peace','sign']),
    _S('thumbs-up',    'emotions','Thumbs Up',    '👍','#FFD9B5',['thumbs','up','good']),

    // ---- Decorations ----
    _S('star-deco',    'decorations','Star',        '⭐','#FFE17A',['star','sparkle']),
    _S('glow-star',    'decorations','Glow Star',   '🌟','#FFE17A',['star','glow','shine']),
    _S('sparkle-deco', 'decorations','Sparkle',    '✨','#FFF1A8',['sparkle','shine']),
    _S('dizzy',        'decorations','Dizzy',      '💫','#FFE0AC',['dizzy','spark']),
    _S('boom',         'decorations','Boom',       '💥','#FFB089',['boom','bang']),
    _S('check',        'decorations','Check',      '✅','#B5E2B5',['check','done','yes']),
    _S('crossmark',    'decorations','No',         '❌','#FFB0B0',['no','cross','wrong']),
    _S('arrow-right',  'decorations','Arrow',      '➡️','#A9D2E0',['arrow','direction']),
    _S('arrow-left',   'decorations','Arrow Left', '⬅️','#A9D2E0',['arrow','direction']),
    _S('arrow-up',     'decorations','Arrow Up',   '⬆️','#A9D2E0',['arrow','up']),
    _S('arrow-down',   'decorations','Arrow Down', '⬇️','#A9D2E0',['arrow','down']),
    _S('speech',       'decorations','Speech',     '💬','#A9D2EA',['speech','talk','bubble']),
    _S('thought',      'decorations','Thought',    '💭','#D2DDE8',['thought','bubble']),
    _S('musical-note', 'decorations','Music Note', '🎵','#C9B6F2',['music','note']),
    _S('musical-notes','decorations','Music Notes','🎶',  '#C9B6F2',['music','notes']),
    _S('question',     'decorations','Question',   '❓','#FFC0E0',['question','mark']),
    _S('exclaim',      'decorations','Exclaim',    '❗','#FFC0C0',['exclaim','mark']),
    _S('hundred',      'decorations','100',        '💯','#FFB0B0',['hundred','100','points'])
  ];

  // Quick lookup by id.
  const _byId={};
  STICKERS.forEach(function(st){ _byId[st.id]=st; });

  function getCategories(){ return CATEGORIES.slice(); }
  function getCategory(id){ return CATEGORIES.find(function(c){ return c.id===id; })||null; }
  function getAll(){ return STICKERS.slice(); }
  function getByCategory(catId){
    return STICKERS.filter(function(st){ return st.category===catId; });
  }
  function getById(id){ return _byId[id]||null; }

  // Match against name + keywords + category label. Case-insensitive.
  function search(q){
    const needle=String(q||'').trim().toLowerCase();
    if(!needle) return STICKERS.slice();
    return STICKERS.filter(function(st){
      if(st.name.toLowerCase().indexOf(needle)!==-1) return true;
      if(st.category.indexOf(needle)!==-1) return true;
      for(let i=0;i<st.keywords.length;i++){
        if(st.keywords[i].indexOf(needle)!==-1) return true;
      }
      return false;
    });
  }

  // Data URL for the SVG — used as the canvas-side Image source and as
  // the grid thumbnail src. Cached so we hand back the same URL across
  // calls.
  const _dataUrlCache={};
  function getDataURL(id){
    if(_dataUrlCache[id]) return _dataUrlCache[id];
    const st=getById(id);
    if(!st) return null;
    const url='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(st.svg);
    _dataUrlCache[id]=url;
    return url;
  }

  const api={
    CATEGORIES:CATEGORIES,
    getCategories:getCategories,
    getCategory:getCategory,
    getAll:getAll,
    getByCategory:getByCategory,
    getById:getById,
    search:search,
    getDataURL:getDataURL
  };
  try{ window.StickerLibrary=api; }catch(e){}
  return api;
})();
