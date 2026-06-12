import { ApolloClient, InMemoryCache, split, HttpLink } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';

// Direkte Backend-URLs (nicht durch Proxy)
const BACKEND_URL = 'http://localhost:4000/graphql';
const BACKEND_WS = 'ws://localhost:4000/graphql';
const TOKEN_KEY   = 'auth_token';

const httpLink = new HttpLink({ uri: BACKEND_URL });

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem(TOKEN_KEY);
  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
});

const wsLink = new GraphQLWsLink(
  createClient({ 
    url: BACKEND_WS,
    connectionParams: () => {
      const token = localStorage.getItem(TOKEN_KEY);
      return token ? { authorization: `Bearer ${token}` } : {};
    },
    shouldRetry: () => true
  })
);

export const client = new ApolloClient({
  link: split(
    ({ query }) => {
      const def = getMainDefinition(query);
      return def.kind === 'OperationDefinition' && def.operation === 'subscription';
    },
    wsLink,
    authLink.concat(httpLink)
  ),
  cache: new InMemoryCache()
});