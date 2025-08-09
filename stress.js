import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
  },
};

const tokens = []; //check from db 

export default function () {
  const url = 'http://localhost:8080/bookTicket';
  const payload = JSON.stringify({
    eventId: '689516d11a4fb2f7318ccbf8',
  });

  //const token = tokens[(__VU - 1) % tokens.length];

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };

  const res = http.post(url, payload, params);

  check(res, {
    'status is 201 or 200': (r) => r.status === 201 || r.status === 200,
    'no error message': (r) => !r.json('error'),
  });

  sleep(1);
}
