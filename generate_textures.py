from PIL import Image, ImageDraw
from pathlib import Path
import math
import random

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'assets' / 'textures'
OUT.mkdir(parents=True, exist_ok=True)
SIZE = 32
SEED = 90521


def clamp(v):
    return max(0, min(255, int(v)))


def jitter(c, amount, rng):
    return tuple(clamp(x + rng.randint(-amount, amount)) for x in c)


def noise_texture(name, base, amount=18, accents=(), alpha=255):
    rng = random.Random(f'{SEED}:{name}')
    im = Image.new('RGBA', (SIZE, SIZE))
    px = im.load()
    for y in range(SIZE):
        for x in range(SIZE):
            col = jitter(base, amount, rng)
            if accents and rng.random() < .06:
                col = jitter(rng.choice(accents), max(2, amount // 2), rng)
            px[x, y] = (*col, alpha)
    return im


def grass_top():
    im = noise_texture('grass_top', (78, 148, 53), 22, [(104, 174, 69), (47, 116, 37), (125, 184, 70)])
    d = ImageDraw.Draw(im); rng = random.Random(f'{SEED}:grass_top:stems')
    for _ in range(58):
        x, y = rng.randrange(SIZE), rng.randrange(SIZE)
        c = rng.choice([(45,106,34,255),(132,190,77,255),(65,133,42,255)])
        d.point((x,y), fill=c)
        if rng.random() < .35 and x + 1 < SIZE: d.point((x+1,y), fill=c)
    return im


def dirt(): return noise_texture('dirt', (126,87,52), 22, [(91,59,38),(159,111,68),(104,73,49)])


def grass_side():
    im = dirt(); rng = random.Random(f'{SEED}:grass_side'); px = im.load()
    for y in range(9):
        for x in range(SIZE): px[x,y] = (*jitter((76,145,51) if y < 6 else (72,132,47), 18, rng),255)
    for x in range(SIZE):
        if rng.random() < .55:
            depth = rng.randint(1,7)
            for y in range(8, min(SIZE, 8+depth)):
                blend = max(0, 1-(y-8)/max(1,depth)); old=px[x,y]; base=(69,132,45)
                px[x,y] = (*tuple(clamp(old[i]*(1-.75*blend)+base[i]*(.75*blend)) for i in range(3)),255)
    return im


def stone():
    im=noise_texture('stone',(126,128,127),18,[(92,95,94),(157,159,157)]); d=ImageDraw.Draw(im); rng=random.Random(f'{SEED}:stone:veins')
    for _ in range(14):
        x,y=rng.randrange(SIZE),rng.randrange(SIZE); col=rng.choice([(88,91,92,255),(164,166,165,255)])
        for i in range(rng.randint(2,6)): d.point((min(31,x+i),min(31,y+i//3)),fill=col)
    return im


def sand(): return noise_texture('sand',(211,195,132),13,[(231,216,153),(181,164,108)])


def log_side():
    rng=random.Random(f'{SEED}:log_side'); im=Image.new('RGBA',(SIZE,SIZE),(133,96,55,255)); px=im.load(); bands=[0,5,10,17,23,29]
    for x in range(SIZE):
        nearest=min(abs(x-b) for b in bands); base=99 if nearest<=1 else 132
        for y in range(SIZE):
            wobble=int(8*math.sin(y*.47+x*.19)); px[x,y]=(*jitter((base+wobble,75+wobble//2,39),10,rng),255)
    return im


def log_top():
    rng=random.Random(f'{SEED}:log_top'); im=Image.new('RGBA',(SIZE,SIZE)); px=im.load(); c=(SIZE-1)/2
    for y in range(SIZE):
        for x in range(SIZE):
            ring=int(math.hypot(x-c,y-c)/2.7)%2; base=(159,119,68) if ring==0 else (129,91,51); px[x,y]=(*jitter(base,11,rng),255)
    return im


def leaves():
    rng=random.Random(f'{SEED}:leaves'); im=Image.new('RGBA',(SIZE,SIZE),(0,0,0,0)); px=im.load(); palette=[(48,118,43),(62,137,48),(80,151,55),(38,101,38),(103,167,63)]
    for y in range(SIZE):
        for x in range(SIZE):
            px[x,y]=(0,0,0,0) if rng.random()<.11 and 2<x<29 and 2<y<29 else (*jitter(rng.choice(palette),10,rng),255)
    d=ImageDraw.Draw(im)
    for _ in range(32):
        x,y=rng.randrange(SIZE),rng.randrange(SIZE); d.rectangle((x,y,min(31,x+1),min(31,y+1)),fill=(34,91,35,255))
    return im


def brick():
    rng=random.Random(f'{SEED}:brick'); im=Image.new('RGBA',(SIZE,SIZE)); px=im.load()
    for y in range(SIZE):
        row=y//8
        for x in range(SIZE):
            mortar=y%8 in (0,7) or (x+(8 if row%2 else 0))%16 in (0,15)
            px[x,y]=(*jitter((181,168,148) if mortar else (155,70,51),8 if mortar else 17,rng),255)
    return im


def glowstone():
    rng=random.Random(f'{SEED}:glow'); im=noise_texture('glow',(205,145,56),25,[(245,210,111),(135,85,43)]); d=ImageDraw.Draw(im)
    for _ in range(12):
        x,y=rng.randrange(1,27),rng.randrange(1,27); w,h=rng.randrange(2,6),rng.randrange(2,6); d.rectangle((x,y,x+w,y+h),outline=(112,67,37,255))
    return im


def planks(name='planks', base=(164,116,63)):
    rng=random.Random(f'{SEED}:{name}'); im=Image.new('RGBA',(SIZE,SIZE)); px=im.load()
    for y in range(SIZE):
        seam=y%8 in (0,7); row=y//8
        for x in range(SIZE):
            v=int(7*math.sin(x*.55+row)); b=(base[0]+v,base[1]+v//2,base[2]); px[x,y]=(*jitter((55,39,28) if seam else b,8,rng),255)
    for row in range(4):
        x=(row*11+5)%32
        for yy in range(row*8+1,min(row*8+7,32)): px[x,yy]=(max(20,base[0]-78),max(15,base[1]-59),max(10,base[2]-31),255)
    return im


def cobble(name='cobble', base=(104,108,105), moss=False):
    rng=random.Random(f'{SEED}:{name}'); im=noise_texture(name,base,13); d=ImageDraw.Draw(im)
    for y0 in range(0,32,8):
        off=4 if (y0//8)%2 else 0
        for x0 in range(-off,32,10): d.rounded_rectangle((x0+1,y0+1,x0+9,y0+7),radius=2,outline=(62,65,64,255),width=1)
    if moss:
        for _ in range(36):
            x,y=rng.randrange(32),rng.randrange(32); d.rectangle((x,y,min(31,x+rng.randrange(1,4)),min(31,y+rng.randrange(1,3))),fill=(64,101+rng.randrange(-12,13),52,255))
    return im


def glass():
    im=Image.new('RGBA',(SIZE,SIZE),(174,222,232,70)); d=ImageDraw.Draw(im)
    d.rectangle((0,0,31,31),outline=(222,247,250,255),width=2); d.rectangle((3,3,28,28),outline=(120,187,201,135),width=1)
    d.line((5,25,25,5),fill=(232,255,255,210),width=2); d.line((20,28,28,20),fill=(222,250,252,170),width=1)
    return im


def wool(name, base):
    rng=random.Random(f'{SEED}:{name}'); im=noise_texture(name,base,15); px=im.load()
    for y in range(SIZE):
        for x in range(SIZE):
            if (x+y)%7==0 or (x-y)%11==0:
                c=px[x,y]; px[x,y]=(clamp(c[0]+10),clamp(c[1]+10),clamp(c[2]+10),255)
    return im


def ore(name, ore_color):
    im=stone().copy(); d=ImageDraw.Draw(im); rng=random.Random(f'{SEED}:{name}')
    for _ in range(11):
        x,y=rng.randrange(2,29),rng.randrange(2,29); c=(*jitter(ore_color,18,rng),255)
        d.rectangle((x,y,x+rng.randrange(1,4),y+rng.randrange(1,4)),fill=c)
        if rng.random()<.55: d.point((x-1,y+1),fill=c)
    return im


def obsidian():
    im=noise_texture('obsidian',(28,20,42),12,[(46,24,67),(18,16,30)]); d=ImageDraw.Draw(im); rng=random.Random(f'{SEED}:obsidian-lines')
    for _ in range(8):
        x,y=rng.randrange(32),rng.randrange(32); d.line((x,y,min(31,x+rng.randrange(3,10)),min(31,y+rng.randrange(1,6))),fill=(71,38,91,255))
    return im


def quartz():
    im=noise_texture('quartz',(222,216,207),8,[(237,233,225),(190,180,170)]); d=ImageDraw.Draw(im)
    d.line((0,10,31,8),fill=(185,171,160,255)); d.line((0,23,31,25),fill=(245,241,232,255))
    return im


def bookshelf():
    im=planks('bookshelf_base'); d=ImageDraw.Draw(im); rng=random.Random(f'{SEED}:books')
    d.rectangle((0,7,31,9),fill=(82,52,29,255)); d.rectangle((0,22,31,24),fill=(82,52,29,255))
    colors=[(140,48,43,255),(45,85,145,255),(62,126,64,255),(177,131,43,255),(105,57,128,255)]
    for shelf_y in (10,25):
        x=2
        while x<30:
            w=rng.choice([2,3]); h=rng.choice([10,11,12]); d.rectangle((x,shelf_y-h,x+w,shelf_y-1),fill=rng.choice(colors)); x+=w+1
    return im


def crafting_top():
    im=planks('crafting_top_base'); d=ImageDraw.Draw(im)
    d.rectangle((3,3,28,28),outline=(78,49,28,255),width=2); d.line((16,4,16,28),fill=(78,49,28,255),width=2); d.line((4,16,28,16),fill=(78,49,28,255),width=2)
    d.rectangle((8,8,13,13),fill=(91,61,35,255)); d.rectangle((19,19,24,24),fill=(91,61,35,255))
    return im


def crafting_side():
    im=planks('crafting_side_base'); d=ImageDraw.Draw(im)
    d.rectangle((3,4,28,27),outline=(75,48,28,255),width=2); d.line((8,6,8,25),fill=(75,48,28,255),width=2); d.line((23,6,23,25),fill=(75,48,28,255),width=2)
    d.rectangle((11,8,20,13),fill=(104,70,38,255)); d.rectangle((11,17,20,23),fill=(88,57,33,255))
    return im


def furnace(front=False):
    im=cobble('furnace_base'); d=ImageDraw.Draw(im)
    if front:
        d.rectangle((6,5,25,14),fill=(58,61,61,255),outline=(33,35,35,255),width=2); d.rectangle((7,19,24,29),fill=(35,35,35,255),outline=(20,20,20,255),width=2)
        d.rectangle((10,22,21,28),fill=(92,55,27,255)); d.rectangle((12,24,19,28),fill=(178,83,31,255))
    return im


def clay(): return noise_texture('clay',(151,169,177),11,[(129,148,158),(177,190,196)])


def pumpkin(side='side'):
    rng=random.Random(f'{SEED}:pumpkin:{side}'); im=Image.new('RGBA',(SIZE,SIZE)); px=im.load()
    if side=='top':
        c=15.5
        for y in range(32):
            for x in range(32):
                ring=int(math.hypot(x-c,y-c)/4)%2; px[x,y]=(*jitter((205,112,24) if ring else (232,132,28),10,rng),255)
        ImageDraw.Draw(im).rectangle((13,13,18,18),fill=(73,91,39,255))
    else:
        for y in range(32):
            for x in range(32):
                groove=(x%7 in (0,1)); px[x,y]=(*jitter((175,83,17) if groove else (225,117,22),10,rng),255)
        if side=='face':
            d=ImageDraw.Draw(im); dark=(57,39,18,255); d.polygon([(6,10),(12,7),(11,14)],fill=dark); d.polygon([(20,7),(26,10),(21,14)],fill=dark); d.polygon([(8,21),(13,18),(17,22),(22,18),(26,22),(24,27),(9,27)],fill=dark)
    return im


def cactus(top=False):
    rng=random.Random(f'{SEED}:cactus:{top}'); im=Image.new('RGBA',(32,32)); px=im.load()
    if top:
        for y in range(32):
            for x in range(32):
                edge=x<2 or x>29 or y<2 or y>29; px[x,y]=(*jitter((38,102,51) if edge else (88,151,65),8,rng),255)
        ImageDraw.Draw(im).ellipse((9,9,22,22),outline=(50,119,54,255),width=2)
    else:
        for y in range(32):
            for x in range(32):
                stripe=x%8 in (0,1); px[x,y]=(*jitter((42,111,48) if stripe else (76,147,61),8,rng),255)
        d=ImageDraw.Draw(im)
        for y in range(4,32,8): d.point((5,y),fill=(225,222,176,255)); d.point((23,y+2),fill=(225,222,176,255))
    return im


def concrete():
    im=Image.new('RGBA',(32,32)); d=ImageDraw.Draw(im); cols=[(216,64,58,255),(238,193,55,255),(65,143,202,255),(73,167,90,255)]
    d.rectangle((0,0,15,15),fill=cols[0]); d.rectangle((16,0,31,15),fill=cols[1]); d.rectangle((0,16,15,31),fill=cols[2]); d.rectangle((16,16,31,31),fill=cols[3])
    d.line((15,0,15,31),fill=(235,235,235,255),width=2); d.line((0,15,31,15),fill=(235,235,235,255),width=2)
    return im


def bedrock():
    return noise_texture('bedrock',(54,55,55),28,[(22,23,23),(91,92,91)])

textures = {
    'grass_top': grass_top(), 'grass_side': grass_side(), 'dirt': dirt(), 'stone': stone(), 'sand': sand(),
    'log_side': log_side(), 'log_top': log_top(), 'leaves': leaves(), 'brick': brick(), 'glowstone': glowstone(),
    'planks': planks(), 'cobble': cobble(), 'glass': glass(),
    'wool_white': wool('wool_white',(220,220,216)), 'wool_red': wool('wool_red',(167,49,48)),
    'wool_blue': wool('wool_blue',(54,86,164)), 'wool_green': wool('wool_green',(67,132,62)),
    'wool_yellow': wool('wool_yellow',(213,177,48)), 'coal_ore': ore('coal_ore',(42,43,43)),
    'iron_ore': ore('iron_ore',(181,137,104)), 'gold_ore': ore('gold_ore',(224,182,46)),
    'diamond_ore': ore('diamond_ore',(55,205,205)), 'obsidian': obsidian(), 'quartz': quartz(),
    'bookshelf': bookshelf(), 'crafting_side': crafting_side(), 'crafting_top': crafting_top(),
    'furnace_side': furnace(False), 'furnace_front': furnace(True), 'snow': noise_texture('snow',(235,241,242),7,[(215,228,232),]),
    'clay': clay(), 'mossy_cobble': cobble('mossy_cobble',(99,106,99),True), 'dark_planks': planks('dark_planks',(94,67,48)),
    'pumpkin_side': pumpkin('side'), 'pumpkin_top': pumpkin('top'), 'pumpkin_face': pumpkin('face'),
    'cactus_side': cactus(False), 'cactus_top': cactus(True), 'concrete': concrete(), 'bedrock': bedrock(),
}

for name, im in textures.items(): im.save(OUT / f'{name}.png')
cols = 8
rows = math.ceil(len(textures) / cols)
atlas = Image.new('RGBA',(cols*SIZE,rows*SIZE),(0,0,0,0))
order = list(textures.keys())
for i,name in enumerate(order): atlas.alpha_composite(textures[name],((i%cols)*SIZE,(i//cols)*SIZE))
atlas.save(ROOT/'assets'/'atlas.png')
print('Generated',len(textures),'32x32 textures:',cols,'x',rows)
