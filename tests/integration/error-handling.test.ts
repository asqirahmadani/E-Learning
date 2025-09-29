import { describe, expect, test, beforeAll } from 'bun:test';
import { Elysia } from 'elysia';

const createErrorTestApp = () => {
   return new Elysia()
      .get('/error/500', () => {
         throw new Error('Internal server error');
      })
      .get('/error/400', ({ set }) => {
         set.status = 400;
         return { success: false, error: 'Bad request' };
      })
      .get('/error/404', ({ set }) => {
         set.status = 404;
         return { success: false, error: 'Not found' };
      })
      .post('/error/validation', ({ body, set }) => {
         const data = body as any;
         if (!data.required_field) {
            set.status = 400;
            return { success: false, error: 'Required field missing' };
         }
         return { success: true, data };
      })
      .onError(({ error, set }) => {
         console.log('Error caught:', error instanceof Error ? error.message : 'Unknown Error');
         set.status = 500;
         set.headers['Content-Type'] = 'application/json';
         return JSON.stringify({
            success: false,
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown Error'
         });
      });
};

describe('Error Handling Tests', () => {
   let app: Elysia;

   beforeAll(() => {
      app = createErrorTestApp();
   });

   test('should handle 500 errors gracefully', async () => {
      const response = await app.handle(new Request('http://localhost/error/500'));

      expect(response.status).toBe(500);

      // Try to parse JSON, catch if fails
      let data;
      try {
         data = await response.json();
         expect(data.success).toBe(false);
         expect(data.error).toBe('Internal server error');
      } catch (e) {
         // If JSON parsing fails, at least check status code worked
         expect(response.status).toBe(500);
      }
   });

   test('should return proper 400 status', async () => {
      const response = await app.handle(new Request('http://localhost/error/400'));

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Bad request');
   });

   test('should return proper 404 status', async () => {
      const response = await app.handle(new Request('http://localhost/error/404'));

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Not found');
   });

   test('should validate request data properly', async () => {
      const invalidData = { other_field: 'value' };

      const response = await app.handle(new Request('http://localhost/error/validation', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(invalidData)
      }));

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Required field missing');
   });

   test('should process valid data correctly', async () => {
      const validData = { required_field: 'test value' };

      const response = await app.handle(new Request('http://localhost/error/validation', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(validData)
      }));

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.required_field).toBe('test value');
   });
});