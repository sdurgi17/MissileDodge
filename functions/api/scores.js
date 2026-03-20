function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit')) || 50, 1), 100);

  try {
    const { results } = await context.env.DB.prepare(
      'SELECT id, name, score, enemies_destroyed, highest_combo, waves_survived, created_at FROM scores ORDER BY score DESC LIMIT ?'
    ).bind(limit).all();

    return jsonResponse(results);
  } catch (e) {
    return jsonResponse({ error: 'Failed to fetch scores' }, 500);
  }
}

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const { name, score, enemiesDestroyed, highestCombo, wavesSurvived } = body;

  // Validate name
  if (!name || typeof name !== 'string') {
    return jsonResponse({ error: 'Name is required' }, 400);
  }
  const trimmedName = name.trim();
  if (trimmedName.length < 1 || trimmedName.length > 20) {
    return jsonResponse({ error: 'Name must be 1-20 characters' }, 400);
  }
  if (!/^[a-zA-Z0-9 ]+$/.test(trimmedName)) {
    return jsonResponse({ error: 'Name must be alphanumeric (spaces allowed)' }, 400);
  }

  // Validate score
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 0) {
    return jsonResponse({ error: 'Score must be a non-negative integer' }, 400);
  }

  const enemies = Number.isInteger(enemiesDestroyed) ? enemiesDestroyed : 0;
  const combo = Number.isInteger(highestCombo) ? highestCombo : 0;
  const waves = Number.isInteger(wavesSurvived) ? wavesSurvived : 0;

  try {
    // Rate limit: max 3 submissions per name per minute
    const { results: recent } = await context.env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM scores WHERE name = ? AND created_at > datetime('now', '-1 minute')"
    ).bind(trimmedName).all();

    if (recent[0]?.cnt >= 3) {
      return jsonResponse({ error: 'Rate limited. Try again in a minute.' }, 429);
    }

    // Insert score
    await context.env.DB.prepare(
      'INSERT INTO scores (name, score, enemies_destroyed, highest_combo, waves_survived) VALUES (?, ?, ?, ?, ?)'
    ).bind(trimmedName, score, enemies, combo, waves).run();

    // Get rank
    const { results: rankResult } = await context.env.DB.prepare(
      'SELECT COUNT(*) + 1 as rank FROM scores WHERE score > ?'
    ).bind(score).all();

    const rank = rankResult[0]?.rank || 0;

    return jsonResponse({ success: true, rank });
  } catch (e) {
    return jsonResponse({ error: 'Failed to submit score' }, 500);
  }
}
