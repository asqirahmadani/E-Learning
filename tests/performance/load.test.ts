import { describe, expect, test, beforeAll } from 'bun:test';
import { Elysia } from 'elysia';
import { initTestDatabase, closeTestDb } from '../setup';

const createSimpleApp = () => {
   return new Elysia()
      .get('/health', () => ({ status: 'ok', timestamp: Date.now() }))
      .get('/slow', async () => {
         // Simulate slow operation
         await new Promise(resolve => setTimeout(resolve, 100));
         return { status: 'completed' };
      });
};

describe('Performance Tests', () => {
   let app: Elysia;

   beforeAll(() => {
      initTestDatabase();
      app = createSimpleApp();
   });

   test('should respond to health check quickly', async () => {
      const start = performance.now();

      const response = await app.handle(new Request('http://localhost/health'));

      const duration = performance.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(50); // Should respond in less than 50ms

      const data = await response.json();
      expect(data.status).toBe('ok');
   });

   test('should handle concurrent requests', async () => {
      const numberOfRequests = 10;
      const requests = Array(numberOfRequests).fill(null).map(() =>
         app.handle(new Request('http://localhost/health'))
      );

      const start = performance.now();
      const responses = await Promise.all(requests);
      const duration = performance.now() - start;

      // All requests should succeed
      responses.forEach(response => {
         expect(response.status).toBe(200);
      });

      // Total time should be reasonable (not sequential)
      expect(duration).toBeLessThan(200); // Should handle 10 concurrent requests in less than 200ms
   });

   test('should timeout appropriately for slow requests', async () => {
      const start = performance.now();

      const response = await app.handle(new Request('http://localhost/slow'));

      const duration = performance.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeGreaterThan(90); // Should take at least 90ms due to setTimeout
      expect(duration).toBeLessThan(200); // But not too much longer
   });
});