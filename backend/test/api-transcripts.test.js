import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';

// Mock server setup for testing transcript API endpoints
describe('Transcript API Endpoints', () => {
  const BASE_URL = 'http://localhost:3002/api';
  let testTranscriptId;

  // Helper function to make HTTP requests
  const makeRequest = (method, path, body = null) => {
    return new Promise((resolve, reject) => {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const req = http.request(`${BASE_URL}${path}`, options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : null;
            resolve({ status: res.statusCode, data: parsed });
          } catch (error) {
            resolve({ status: res.statusCode, data: data });
          }
        });
      });

      req.on('error', reject);

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  };

  it('should create a new transcript', async () => {
    const transcript = {
      title: 'Test Transcript',
      transcript_text: 'This is a test transcript about unit testing.',
      audio_file_name: 'test.webm',
      duration: 12.5,
    };

    const response = await makeRequest('POST', '/transcripts', transcript);

    assert.strictEqual(response.status, 200);
    assert.ok(response.data.id);
    assert.strictEqual(response.data.title, transcript.title);
    assert.strictEqual(response.data.transcript_text, transcript.transcript_text);
    assert.strictEqual(response.data.duration, transcript.duration);

    testTranscriptId = response.data.id;
  });

  it('should get all transcripts', async () => {
    const response = await makeRequest('GET', '/transcripts');

    assert.strictEqual(response.status, 200);
    assert.ok(Array.isArray(response.data));
    assert.ok(response.data.length > 0);
  });

  it('should get a specific transcript by ID', async () => {
    const response = await makeRequest('GET', `/transcripts/${testTranscriptId}`);

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.data.id, testTranscriptId);
    assert.ok(response.data.transcript_text);
  });

  it('should return 404 for non-existent transcript', async () => {
    const response = await makeRequest('GET', '/transcripts/non-existent-id');

    assert.strictEqual(response.status, 404);
    assert.ok(response.data.error);
  });

  it('should delete a transcript', async () => {
    const response = await makeRequest('DELETE', `/transcripts/${testTranscriptId}`);

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.data.success, true);

    // Verify deletion
    const getResponse = await makeRequest('GET', `/transcripts/${testTranscriptId}`);
    assert.strictEqual(getResponse.status, 404);
  });

  it('should validate required fields when creating transcript', async () => {
    const invalidTranscript = {
      title: 'Test',
      // Missing transcript_text
    };

    const response = await makeRequest('POST', '/transcripts', invalidTranscript);

    // Should handle gracefully or return error
    assert.ok(response.status === 400 || response.status === 500);
  });

  it('should handle empty transcript list', async () => {
    // Delete all transcripts first
    const allResponse = await makeRequest('GET', '/transcripts');
    for (const transcript of allResponse.data) {
      await makeRequest('DELETE', `/transcripts/${transcript.id}`);
    }

    const response = await makeRequest('GET', '/transcripts');

    assert.strictEqual(response.status, 200);
    assert.ok(Array.isArray(response.data));
    assert.strictEqual(response.data.length, 0);
  });
});

