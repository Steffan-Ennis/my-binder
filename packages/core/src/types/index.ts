export interface Card {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CardList {
  cards: Card[];
  total: number;
}

export interface CreateCardBody {
  name: string;
}

export interface UpdateCardBody {
  name: string;
}

export interface CardIdParams {
  id: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  database: 'connected' | 'unavailable';
}

export interface ErrorBody {
  error: string;
  message: string;
}
