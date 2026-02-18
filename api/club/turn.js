export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    const body = req.body || {};
    const playerText = body.playerText || '';
  
    return res.status(200).json({
      npcText: `なるほどね。「${playerText}」って言うんだ`,
      deltaHint: {
        affinity: 1,
        interest: 1,
        irritation: 0
      },
      flags: { forceEnd: false }
    });
  }
  