// The invented RPG on Nolan's monitor/phone: "AETHERFALL — Ember Chronicle".
// Pixel-art drawn from string sprites; nothing here references a real game.
import { Ctx, within } from '../lib/brush';
import { clamp, easeOut, hash, rgba, smooth } from '../lib/math';

const HERO = [
  '.....hhhh.....',
  '....hhhhhh....',
  '...hhssssh....',
  '....swsswS....',
  '....ssssss....',
  '.....ssss.....',
  '...cBBBBBBc...',
  '..ccBBYYBBcc.x',
  '..csBBBBBBsc.x',
  '..c.BBBBBB.cx.',
  '....BBbbBB..x.',
  '....BB..BB....',
  '....gg..gg....',
  '...ggg..ggg...',
];
const SLIME = [
  '.....pppp.....',
  '...pppppppp...',
  '..ppPPppppppp.',
  '.pppPppppppppp',
  '.ppwwppppwwppp',
  'pppwkppppwkpppp',
  'ppppppmmppppppp',
  'pppppppppppppp',
  '.pppppppppppp.',
];
const COLORS: Record<string, string> = {
  h: '#3e2c25', s: '#f1c9a8', S: '#d9a985', w: '#ffffff', c: '#2d6cdf', B: '#2b3550', Y: '#e8c45a', b: '#5a4632',
  g: '#2a2220', x: '#d8e6ff', p: '#7b3fd0', P: '#b48cff', k: '#1a0b2e', m: '#3a1250',
};

function sprite(ctx: Ctx, rows: string[], x: number, y: number, px: number, alpha = 1, tint?: string) {
  within(ctx, () => {
    ctx.globalAlpha = alpha;
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const c = row[i];
        if (c === '.') continue;
        ctx.fillStyle = tint ?? COLORS[c] ?? '#f0f';
        ctx.fillRect(x + i * px, y + j * px, px + 0.5, px + 0.5);
      }
    });
  });
}

/**
 * Draws the game into the rect (x,y,w,h). `lt` = seconds since the
 * level-up cue (negative before it).
 */
export function drawGame(ctx: Ctx, x: number, y: number, w: number, h: number, t: number, lt: number, mode: 'battle' | 'continue' = 'battle') {
  within(ctx, () => {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.translate(x, y);
    const k = w / 320; // virtual 320x180 screen
    ctx.scale(k, k);
    const H = (h / w) * 320;
    // sky
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1b1446');
    g.addColorStop(0.55, '#5a3d8c');
    g.addColorStop(1, '#e48a6a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 320, H);
    // pixel stars
    for (let i = 0; i < 40; i++) {
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i));
      ctx.fillStyle = rgba('#ffffff', tw * 0.8);
      ctx.fillRect(Math.floor(hash(i, 3) * 320), Math.floor(hash(i, 4) * H * 0.45), 1.2, 1.2);
    }
    // stepped mountains
    ctx.fillStyle = '#2a1f4d';
    for (let i = 0; i < 32; i++) {
      const hh = 30 + Math.abs(Math.sin(i * 0.7)) * 34 + (i % 3) * 4;
      ctx.fillRect(i * 10, H * 0.62 - hh, 10.5, hh);
    }
    ctx.fillStyle = '#1d1638';
    for (let i = 0; i < 40; i++) {
      const hh = 14 + Math.abs(Math.sin(i * 1.3 + 1)) * 20;
      ctx.fillRect(i * 8, H * 0.7 - hh, 8.5, hh);
    }
    // ground tiles
    for (let i = 0; i < 40; i++) for (let j = 0; j < 6; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#2f5d3a' : '#346b40';
      ctx.fillRect(i * 8, H * 0.7 + j * 8, 8.5, 8.5);
    }

    if (mode === 'battle') {
      // hero idle bob & slime
      const bob = Math.round(Math.sin(t * 4) * 1);
      sprite(ctx, HERO, 36, H * 0.7 - 56 + bob, 4);
      const defeated = clamp(lt / 0.6 + 0.6);
      const slimeA = 1 - defeated;
      if (slimeA > 0) sprite(ctx, SLIME, 226, H * 0.7 - 36, 4, slimeA, lt > -0.4 && Math.floor(t * 12) % 2 ? '#ffffff' : undefined);
      // slash arc
      if (lt > -0.6 && lt < -0.1) {
        ctx.strokeStyle = rgba('#ffffff', 1 - (lt + 0.6) / 0.5);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(220, H * 0.7 - 24, 26, -1.2, 0.9);
        ctx.stroke();
      }
      // damage number
      if (lt > -0.4 && lt < 0.8) {
        ctx.font = '700 14px "Noto Sans", sans-serif';
        ctx.fillStyle = '#ffd36b';
        ctx.fillText('9 999', 200, H * 0.7 - 50 - (lt + 0.4) * 20);
      }
    } else {
      sprite(ctx, HERO, 140, H * 0.7 - 56, 4);
    }

    // HUD
    ctx.fillStyle = 'rgba(10,12,30,0.75)';
    ctx.fillRect(6, 6, 118, 40);
    ctx.strokeStyle = '#c9d6ff';
    ctx.lineWidth = 1;
    ctx.strokeRect(6.5, 6.5, 117, 39);
    ctx.font = '700 9px "Noto Sans", sans-serif';
    ctx.fillStyle = '#ffffff';
    const lvl = lt >= 0 ? 99 : 98;
    ctx.fillText(`NOLAN_L   Lv ${lvl}`, 12, 18);
    ctx.fillStyle = '#3b1420'; ctx.fillRect(12, 23, 100, 5);
    ctx.fillStyle = '#ff5a6e'; ctx.fillRect(12, 23, 100 * (lt >= 0 ? 1 : 0.82), 5);
    ctx.fillStyle = '#10213d'; ctx.fillRect(12, 31, 100, 5);
    ctx.fillStyle = '#58a6ff'; ctx.fillRect(12, 31, 100 * (lt >= 0 ? 1 : 0.64), 5);
    // EXP bar
    const exp = lt < -0.3 ? 0.86 : lt < 0 ? 0.86 + (lt + 0.3) / 0.3 * 0.14 : (lt % 1) * 0.06;
    ctx.fillStyle = '#2a2405'; ctx.fillRect(12, 39, 100, 3);
    ctx.fillStyle = '#ffd36b'; ctx.fillRect(12, 39, 100 * exp, 3);

    if (mode === 'battle' && lt >= 0) {
      // LEVEL UP burst
      const a = easeOut(lt / 0.35);
      for (let i = 0; i < 26; i++) {
        const ang = (i / 26) * Math.PI * 2;
        const r = 10 + lt * 140 * (0.6 + hash(i, 5) * 0.6);
        ctx.fillStyle = rgba(i % 2 ? '#ffe28a' : '#ffffff', clamp(1 - lt / 1.4));
        ctx.fillRect(166 + Math.cos(ang) * r, H * 0.36 + Math.sin(ang) * r * 0.6, 3, 3);
      }
      ctx.save();
      ctx.translate(166, H * 0.36);
      const sc = 0.6 + 0.4 * a + Math.sin(lt * 6) * 0.02;
      ctx.scale(sc, sc);
      ctx.textAlign = 'center';
      ctx.font = '700 34px "Noto Sans", sans-serif';
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#4a1d00';
      ctx.strokeText('LEVEL UP!', 0, 0);
      const gg = ctx.createLinearGradient(0, -28, 0, 4);
      gg.addColorStop(0, '#fff6c4');
      gg.addColorStop(1, '#ffb52e');
      ctx.fillStyle = gg;
      ctx.fillText('LEVEL UP!', 0, 0);
      ctx.font = '700 12px "Noto Sans", sans-serif';
      ctx.fillStyle = rgba('#ffffff', smooth(0.25, 0.5, lt));
      ctx.fillText('Seviye 98  →  99', 0, 20);
      ctx.restore();
      // new skill toast
      if (lt > 0.6) {
        const ta = smooth(0.6, 0.9, lt);
        ctx.fillStyle = rgba('#0b1030', 0.8 * ta);
        ctx.fillRect(196, 54, 116, 22);
        ctx.strokeStyle = rgba('#ffd36b', ta);
        ctx.strokeRect(196.5, 54.5, 115, 21);
        ctx.font = '700 8px "Noto Sans", sans-serif';
        ctx.fillStyle = rgba('#ffe7a8', ta);
        ctx.textAlign = 'left';
        ctx.fillText('Yeni yetenek: Ember Edge', 202, 68);
      }
    }
    if (mode === 'continue') {
      ctx.fillStyle = 'rgba(5,8,20,0.82)';
      ctx.fillRect(40, H * 0.3, 240, 60);
      ctx.strokeStyle = '#c9d6ff';
      ctx.strokeRect(40.5, H * 0.3 + 0.5, 239, 59);
      ctx.textAlign = 'center';
      ctx.font = '700 15px "Noto Sans", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('DEVAM EDİLSİN Mİ?', 160, H * 0.3 + 26);
      ctx.font = '700 11px "Noto Sans", sans-serif';
      ctx.fillStyle = Math.floor(t * 3) % 2 ? '#ffd36b' : '#ffffff';
      ctx.fillText('▶ EVET        HAYIR', 160, H * 0.3 + 46);
    }
    // title watermark
    ctx.textAlign = 'right';
    ctx.font = '600 7px "Cinzel", serif';
    ctx.fillStyle = 'rgba(255,240,210,0.55)';
    ctx.fillText('AETHERFALL · Ember Chronicle', 314, H - 6);
    // scanlines
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let yy = 0; yy < H; yy += 2) ctx.fillRect(0, yy, 320, 0.7);
  });
}
