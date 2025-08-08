import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },  // ramp up to 50 users
    { duration: '1m', target: 50 },   // stay at 50 users
    { duration: '30s', target: 0 },   // ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% requests under 500ms
  },
};

export default function () {
  const url = 'http://localhost:8080/bookTicket';
  const payload = JSON.stringify({
    eventId: '689516d11a4fb2f7318ccbf8',  
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODk1MTM1OTliMGVjMjc1NTk3YzdmYmMiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTQ2NDI5NzEsImV4cCI6MTc1NTI0Nzc3MX0.5KUHbH7v_jpSIdI7efzOnQjKL2wlXBSb3sT9ABclvdA'
    },
  };

  const res = http.post(url, payload, params);

  check(res, {
    'status is 201 or 200': (r) => r.status === 201 || r.status === 200,
    'no error message': (r) => !r.json('error'),
  });

  sleep(1);
}
