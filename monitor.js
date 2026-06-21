// ============ CONFIGURATION ============
const X_API = {
  consumerKey: 'IBW1oVoW1ze7MmtpM56Ru8S9l',
  consumerSecret: '2WvGXLGCrLtpOKtHRAKDPB8ywu8OIk24hTx7TWz3VM4wyUEtmh',
  accessToken: '2068024413526568960-Zfs9cO1BUqrfrqaBH3sSewAatdJcGo',
  accessSecret: 'YNInpubUxHhcNygbQZ8qkl7k7Tow0JkhzOIpP4GeInMyC'
};

const JHB_WATER_ID = '1083561126260609024';

const OUTAGE_KEYWORDS = [
  'outage', 'no water', 'burst pipe', 'burst main', 'interruption',
  'disruption', 'shutdown', 'maintenance', 'no etr', 'dry',
  'affected', 'repair', 'emergency', 'leak', 'tankers',
  'restored', 'restoration', 'back on'
];

const JOBURG_AREAS = [
  'Soweto', 'Alexandra', 'Lenasia', 'Orange Farm', 'Northriding',
  'Randburg', 'Bryanston', 'Sandton', 'Midrand', 'Diepsloot',
  'Roodepoort', 'Krugersdorp', 'Edenvale', 'Bedfordview',
  'Boskruin', 'Honeydew', 'Fourways', 'Cosmo City',
  'Ennerdale', 'Finetown', 'Lawley', 'Poortjie',
  'Protea Glen', 'Dobsonville', 'Meadowlands', 'Orlando',
  'Diepkloof', 'Pimville', 'Zola', 'Emdeni',
  'Eldorado Park', 'Devland', 'Kliptown', 'Braamfischerville',
  'Ivory Park', 'Tembisa', 'Olivenhoutbosch',
  'Eikenhof', 'Crosby', 'Melville', 'Auckland Park',
  'Greenside', 'Parkhurst', 'Rosebank', 'Hyde Park',
  'Labiance', 'Bellairs', 'Bram Fischer'
];

const LOCATION_COORDS = {
  'Soweto': { lat: -26.2485, lng: 27.8540 },
  'Alexandra': { lat: -26.1057, lng: 28.0520 },
  'Lenasia': { lat: -26.3320, lng: 27.8460 },
  'Orange Farm': { lat: -26.4650, lng: 27.8670 },
  'Northriding': { lat: -26.1050, lng: 27.9550 },
  'Randburg': { lat: -26.0948, lng: 28.0085 },
  'Bryanston': { lat: -26.0530, lng: 28.0200 },
  'Diepsloot': { lat: -25.9350, lng: 28.0100 },
  'Roodepoort': { lat: -26.1625, lng: 27.8725 },
  'Midrand': { lat: -25.9990, lng: 28.1260 },
  'Ennerdale': { lat: -26.4800, lng: 27.8500 },
  'Finetown': { lat: -26.4700, lng: 27.8550 },
  'Boskruin': { lat: -26.0900, lng: 27.9500 },
  'Eikenhof': { lat: -26.3500, lng: 27.9200 },
  'Sandton': { lat: -26.1000, lng: 28.0500 },
  'Johannesburg': { lat: -26.2041, lng: 28.0473 }
};

// ============ MAIN FUNCTION ============
exports.handler = async function(event, context) {
  try {
    console.log('🔍 Checking @JHBWater tweets...');
    
    // Get bearer token
    const bearerToken = await getBearerToken();
    
    // Fetch recent tweets
    const tweets = await fetchTweets(bearerToken);
    
    if (!tweets || tweets.length === 0) {
      console.log('No new tweets found.');
      return { statusCode: 200, body: 'No new tweets' };
    }
    
    console.log(`Found ${tweets.length} tweets to check.`);
    
    // Process each tweet
    for (const tweet of tweets) {
      if (isOutageRelated(tweet.text)) {
        const location = extractLocation(tweet.text);
        const status = determineStatus(tweet.text);
        const coords = getCoords(location);
        
        console.log(`📍 Outage detected: ${location} (${status})`);
        
        // Add to Firebase
        await addToFirebase(location, tweet.text, status, coords);
        
        // Post to X
        await postTweet(location, tweet.text, status);
      }
    }
    
    return { statusCode: 200, body: `Processed ${tweets.length} tweets` };
    
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, body: error.toString() };
  }
};

// ============ GET BEARER TOKEN ============
async function getBearerToken() {
  const credentials = Buffer.from(`${X_API.consumerKey}:${X_API.consumerSecret}`).toString('base64');
  
  const response = await fetch('https://api.twitter.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  
  const data = await response.json();
  return data.access_token;
}

// ============ FETCH TWEETS ============
async function fetchTweets(bearerToken) {
  // Get tweets from last 15 minutes
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  
  const response = await fetch(
    `https://api.twitter.com/2/users/${JHB_WATER_ID}/tweets?max_results=5&tweet.fields=created_at&start_time=${fifteenMinAgo}`,
    {
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  const data = await response.json();
  return data.data || [];
}

// ============ DETECT OUTAGE ============
function isOutageRelated(text) {
  const lower = text.toLowerCase();
  return OUTAGE_KEYWORDS.some(kw => lower.includes(kw));
}

function extractLocation(text) {
  const lower = text.toLowerCase();
  for (const area of JOBURG_AREAS) {
    if (lower.includes(area.toLowerCase())) {
      return area;
    }
  }
  return 'Johannesburg';
}

function determineStatus(text) {
  const lower = text.toLowerCase();
  if (lower.includes('restored') || lower.includes('back on')) return 'active';
  if (lower.includes('outage') || lower.includes('no water') || lower.includes('burst') || lower.includes('dry')) return 'inactive';
  return 'info';
}

function getCoords(area) {
  return LOCATION_COORDS[area] || LOCATION_COORDS['Johannesburg'];
}

// ============ ADD TO FIREBASE ============
async function addToFirebase(location, description, status, coords) {
  const payload = {
    fields: {
      location: { stringValue: location },
      description: { stringValue: description.substring(0, 200) },
      status: { stringValue: status },
      lat: { doubleValue: coords.lat },
      lng: { doubleValue: coords.lng },
      source: { stringValue: '@JHBWater auto-detected' },
      timestamp: { timestampValue: new Date().toISOString() }
    }
  };
  
  await fetch(
    'https://firestore.googleapis.com/v1/projects/amanzi-watch/databases/(default)/documents/reports',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }
  );
}

// ============ POST TO X ============
async function postTweet(location, text, status) {
  const emoji = status === 'active' ? '💧' : status === 'inactive' ? '🚫' : 'ℹ️';
  const statusText = status === 'active' ? 'Water Restored' : status === 'inactive' ? 'Water Outage' : 'Water Update';
  
  const tweetText = `${emoji} ${statusText}: ${location}\n\n@JHBWater reports: ${text.substring(0, 120)}...\n\n📍 Full map: https://amanzi-watch.netlify.app`;
  
  const oauthHeader = generateOAuthHeader('POST', 'https://api.twitter.com/2/tweets');
  
  await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      'Authorization': oauthHeader,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text: tweetText.substring(0, 280) })
  });
}

// ============ OAUTH 1.0 HEADER ============
function generateOAuthHeader(method, url) {
  const crypto = require('crypto');
  
  const oauth = {
    oauth_consumer_key: X_API.consumerKey,
    oauth_token: X_API.accessToken,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_version: '1.0'
  };
  
  const paramString = Object.keys(oauth).sort()
    .map(k => `${k}=${encodeURIComponent(oauth[k])}`).join('&');
  
  const baseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
  const signingKey = `${encodeURIComponent(X_API.consumerSecret)}&${encodeURIComponent(X_API.accessSecret)}`;
  
  oauth.oauth_signature = crypto
    .createHmac('sha1', signingKey)
    .update(baseString)
    .digest('base64');
  
  return 'OAuth ' + Object.keys(oauth).sort()
    .map(k => `${k}="${encodeURIComponent(oauth[k])}"`).join(', ');
}