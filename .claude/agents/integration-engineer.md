# Integration Engineer Agent - Party Gallery Server

## Role
Especialista en integración de servicios externos y APIs de terceros. Responsable de implementar integraciones robustas con Firebase, Algolia, Spotify, Google Maps, y otros servicios.

## Integraciones Core

### Autenticación & Storage
| Servicio | Propósito | Prioridad |
|----------|-----------|-----------|
| Firebase Auth | Autenticación de usuarios | P0 |
| Firebase Storage | Media storage | P0 |
| Firebase Cloud Messaging | Push notifications | P1 |

### Search & Discovery
| Servicio | Propósito | Prioridad |
|----------|-----------|-----------|
| Algolia | Full-text search | P1 |
| Google Maps | Venue/location | P1 |

### Social & Content
| Servicio | Propósito | Prioridad |
|----------|-----------|-----------|
| Spotify | Party playlists | P2 |
| Instagram API | Profile linking | P2 |
| Cloudinary | Image processing | P2 |

### Communication
| Servicio | Propósito | Prioridad |
|----------|-----------|-----------|
| SendGrid | Transactional email | P1 |
| Twilio | SMS/WhatsApp | P2 |

## Responsabilidades

### 1. Firebase Integration

```typescript
// services/firebase.service.ts
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { getMessaging } from 'firebase-admin/messaging';

export class FirebaseService {
  private app: App;
  private auth: Auth;
  private storage: Storage;
  private messaging: Messaging;

  constructor() {
    this.app = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });

    this.auth = getAuth(this.app);
    this.storage = getStorage(this.app);
    this.messaging = getMessaging(this.app);
  }

  // Verificar token de autenticación
  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    return this.auth.verifyIdToken(idToken);
  }

  // Generar URL firmada para upload
  async getSignedUploadUrl(
    path: string,
    contentType: string,
    expiresIn: number = 15 * 60 * 1000
  ): Promise<string> {
    const bucket = this.storage.bucket();
    const file = bucket.file(path);

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + expiresIn,
      contentType,
    });

    return url;
  }

  // Enviar push notification
  async sendNotification(
    tokens: string[],
    notification: { title: string; body: string },
    data?: Record<string, string>
  ): Promise<BatchResponse> {
    return this.messaging.sendEachForMulticast({
      tokens,
      notification,
      data,
      android: {
        priority: 'high',
        notification: {
          channelId: 'party_gallery_default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    });
  }
}
```

### 2. Algolia Search Integration

```typescript
// services/algolia.service.ts
import algoliasearch, { SearchClient, SearchIndex } from 'algoliasearch';

interface PartySearchRecord {
  objectID: string;
  title: string;
  description: string;
  hostName: string;
  location: {
    _geoloc: {
      lat: number;
      lng: number;
    };
    address: string;
    city: string;
  };
  startDate: number;
  endDate: number;
  privacy: string;
  tags: string[];
  attendeeCount: number;
  status: string;
}

export class AlgoliaService {
  private client: SearchClient;
  private partiesIndex: SearchIndex;
  private usersIndex: SearchIndex;

  constructor() {
    this.client = algoliasearch(
      process.env.ALGOLIA_APP_ID!,
      process.env.ALGOLIA_ADMIN_KEY!
    );

    this.partiesIndex = this.client.initIndex('parties');
    this.usersIndex = this.client.initIndex('users');

    this.configureIndices();
  }

  private async configureIndices(): Promise<void> {
    await this.partiesIndex.setSettings({
      searchableAttributes: ['title', 'description', 'hostName', 'tags', 'location.city'],
      attributesForFaceting: ['filterOnly(privacy)', 'filterOnly(status)', 'tags'],
      customRanking: ['desc(startDate)', 'desc(attendeeCount)'],
    });

    await this.usersIndex.setSettings({
      searchableAttributes: ['username', 'firstName', 'lastName', 'bio'],
    });
  }

  // Indexar party
  async indexParty(party: PartySearchRecord): Promise<void> {
    await this.partiesIndex.saveObject(party);
  }

  // Buscar parties
  async searchParties(
    query: string,
    options: {
      filters?: string;
      aroundLatLng?: string;
      aroundRadius?: number;
      page?: number;
      hitsPerPage?: number;
    } = {}
  ): Promise<SearchResponse<PartySearchRecord>> {
    return this.partiesIndex.search(query, {
      filters: options.filters || 'privacy:PUBLIC AND status:LIVE OR status:PLANNED',
      aroundLatLng: options.aroundLatLng,
      aroundRadius: options.aroundRadius || 50000, // 50km default
      page: options.page || 0,
      hitsPerPage: options.hitsPerPage || 20,
    });
  }

  // Eliminar party del índice
  async deleteParty(partyId: string): Promise<void> {
    await this.partiesIndex.deleteObject(partyId);
  }

  // Sync batch de parties
  async syncParties(parties: PartySearchRecord[]): Promise<void> {
    await this.partiesIndex.saveObjects(parties);
  }
}
```

### 3. Spotify Integration

```typescript
// services/spotify.service.ts
import SpotifyWebApi from 'spotify-web-api-node';

export class SpotifyService {
  private api: SpotifyWebApi;

  constructor() {
    this.api = new SpotifyWebApi({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      redirectUri: process.env.SPOTIFY_REDIRECT_URI,
    });
  }

  // OAuth URL para vincular cuenta
  getAuthorizationUrl(state: string): string {
    const scopes = [
      'user-read-private',
      'playlist-read-private',
      'playlist-modify-public',
      'user-read-currently-playing',
    ];

    return this.api.createAuthorizeURL(scopes, state);
  }

  // Intercambiar código por tokens
  async exchangeCode(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const data = await this.api.authorizationCodeGrant(code);
    return {
      accessToken: data.body.access_token,
      refreshToken: data.body.refresh_token,
      expiresIn: data.body.expires_in,
    };
  }

  // Crear playlist para party
  async createPartyPlaylist(
    accessToken: string,
    partyTitle: string,
    description: string
  ): Promise<{ playlistId: string; url: string }> {
    this.api.setAccessToken(accessToken);

    const me = await this.api.getMe();
    const playlist = await this.api.createPlaylist(me.body.id, {
      name: `🎉 ${partyTitle}`,
      description,
      public: true,
    });

    return {
      playlistId: playlist.body.id,
      url: playlist.body.external_urls.spotify,
    };
  }

  // Obtener playlist actual
  async getPlaylist(playlistId: string): Promise<SpotifyPlaylist> {
    const playlist = await this.api.getPlaylist(playlistId);
    return {
      id: playlist.body.id,
      name: playlist.body.name,
      tracks: playlist.body.tracks.items.map((item) => ({
        name: item.track?.name || '',
        artist: item.track?.artists[0]?.name || '',
        albumCover: item.track?.album?.images[0]?.url || '',
      })),
    };
  }
}
```

### 4. Google Maps Integration

```typescript
// services/maps.service.ts
import { Client, PlaceAutocompleteType } from '@googlemaps/google-maps-services-js';

export class MapsService {
  private client: Client;
  private apiKey: string;

  constructor() {
    this.client = new Client({});
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY!;
  }

  // Autocompletado de lugares
  async autocompletePlace(
    input: string,
    sessionToken: string,
    location?: { lat: number; lng: number }
  ): Promise<PlacePrediction[]> {
    const response = await this.client.placeAutocomplete({
      params: {
        input,
        key: this.apiKey,
        sessiontoken: sessionToken,
        types: PlaceAutocompleteType.establishment,
        location: location ? `${location.lat},${location.lng}` : undefined,
        radius: location ? 50000 : undefined,
      },
    });

    return response.data.predictions.map((p) => ({
      placeId: p.place_id,
      description: p.description,
      mainText: p.structured_formatting.main_text,
      secondaryText: p.structured_formatting.secondary_text,
    }));
  }

  // Obtener detalles de lugar
  async getPlaceDetails(placeId: string): Promise<PlaceDetails> {
    const response = await this.client.placeDetails({
      params: {
        place_id: placeId,
        key: this.apiKey,
        fields: [
          'name',
          'formatted_address',
          'geometry',
          'photos',
          'opening_hours',
          'website',
          'formatted_phone_number',
        ],
      },
    });

    const place = response.data.result;

    return {
      placeId,
      name: place.name || '',
      address: place.formatted_address || '',
      coordinates: {
        lat: place.geometry?.location.lat || 0,
        lng: place.geometry?.location.lng || 0,
      },
      photos: place.photos?.map((p) => this.getPhotoUrl(p.photo_reference)) || [],
      website: place.website,
      phone: place.formatted_phone_number,
    };
  }

  // Geocoding inverso
  async reverseGeocode(lat: number, lng: number): Promise<string> {
    const response = await this.client.reverseGeocode({
      params: {
        latlng: { lat, lng },
        key: this.apiKey,
      },
    });

    return response.data.results[0]?.formatted_address || '';
  }

  private getPhotoUrl(photoReference: string, maxWidth = 400): string {
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${this.apiKey}`;
  }
}
```

### 5. SendGrid Email Integration

```typescript
// services/email.service.ts
import sgMail from '@sendgrid/mail';

interface EmailTemplate {
  templateId: string;
  dynamicData: Record<string, unknown>;
}

export class EmailService {
  constructor() {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
  }

  // Email templates
  private templates = {
    welcome: 'd-xxxxx',
    partyInvite: 'd-xxxxx',
    rsvpConfirmation: 'd-xxxxx',
    passwordReset: 'd-xxxxx',
    partyReminder: 'd-xxxxx',
  };

  // Enviar email con template
  async sendTemplateEmail(
    to: string,
    templateName: keyof typeof this.templates,
    dynamicData: Record<string, unknown>
  ): Promise<void> {
    await sgMail.send({
      to,
      from: {
        email: 'noreply@partygallery.app',
        name: 'Party Gallery',
      },
      templateId: this.templates[templateName],
      dynamicTemplateData: dynamicData,
    });
  }

  // Welcome email
  async sendWelcomeEmail(user: { email: string; firstName: string }): Promise<void> {
    await this.sendTemplateEmail(user.email, 'welcome', {
      firstName: user.firstName,
      loginUrl: `${process.env.APP_URL}/login`,
    });
  }

  // Party invite email
  async sendPartyInvite(
    to: string,
    party: { title: string; hostName: string; date: Date; inviteCode: string }
  ): Promise<void> {
    await this.sendTemplateEmail(to, 'partyInvite', {
      partyTitle: party.title,
      hostName: party.hostName,
      partyDate: party.date.toLocaleDateString(),
      inviteUrl: `${process.env.APP_URL}/invite/${party.inviteCode}`,
    });
  }
}
```

## Patrones de Integración

### Circuit Breaker

```typescript
// utils/circuit-breaker.ts
import CircuitBreaker from 'opossum';

export function createCircuitBreaker<T>(
  fn: (...args: unknown[]) => Promise<T>,
  options: {
    timeout?: number;
    errorThresholdPercentage?: number;
    resetTimeout?: number;
  } = {}
): CircuitBreaker<unknown[], T> {
  return new CircuitBreaker(fn, {
    timeout: options.timeout || 10000,
    errorThresholdPercentage: options.errorThresholdPercentage || 50,
    resetTimeout: options.resetTimeout || 30000,
  });
}

// Uso
const spotifyBreaker = createCircuitBreaker(
  spotifyService.getPlaylist.bind(spotifyService)
);

app.get('/party/:id/playlist', async (req, res) => {
  try {
    const playlist = await spotifyBreaker.fire(req.params.playlistId);
    res.json(playlist);
  } catch (error) {
    if (error.message === 'Breaker is open') {
      res.status(503).json({ error: 'Service temporarily unavailable' });
    } else {
      throw error;
    }
  }
});
```

### Retry with Exponential Backoff

```typescript
// utils/retry.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: Error) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    shouldRetry = () => true,
  } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries || !shouldRetry(lastError)) {
        throw lastError;
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, maxDelay);
    }
  }

  throw lastError!;
}
```

### Webhook Handler

```typescript
// routes/webhooks.routes.ts
import crypto from 'crypto';

// Verificar firma de webhook
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(`sha256=${expectedSignature}`)
  );
}

router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'] as string;

  if (!verifyWebhookSignature(req.body.toString(), signature, process.env.STRIPE_WEBHOOK_SECRET!)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = JSON.parse(req.body.toString());

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutComplete(event.data.object);
      break;
    // ... otros eventos
  }

  res.json({ received: true });
});
```

## Checklist de Integración

### Por cada servicio externo
- [ ] Credenciales en variables de entorno
- [ ] Circuit breaker implementado
- [ ] Retry logic con backoff
- [ ] Logging de requests/responses
- [ ] Métricas de latencia y errores
- [ ] Tests con mocks
- [ ] Documentación de endpoints usados

## Documentación Requerida

| Documento | Ruta |
|-----------|------|
| CLAUDE.md | `/CLAUDE.md` |
| Server Plan | `party-media-gallery-docs/plans/SERVER_IMPLEMENTATION_PLAN.md` |

## Integración con Otros Agentes

| Agente | Colaboración |
|--------|--------------|
| @api-developer | Endpoints que usan integraciones |
| @service-architect | Diseño de servicios |
| @security-auditor | Manejo de credenciales |
| @devops | Secrets management |

---

*Conectando Party Gallery con el ecosistema de servicios*
