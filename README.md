# Frosh_25
Ahhh shit, here we go again

# Stress Testing & Queueing Setup

## Background
Initial stress testing using:

```bash
k6 run stress.js
```

...resulted in MongoDB reporting **write-write conflicts** during high concurrency load.

To handle this, **queueing** using [Bull](https://github.com/OptimalBits/bull) and **Redis** has been added to serialize booking operations and prevent direct concurrent writes.

---

## Steps to Run Stress Test

1. **Start Redis**  
   ```bash
   docker run -d -p 6379:6379 redis
   ```

2. **Start Booking Worker**  
   ```bash
   node src/queue/bookingWorker.js
   ```

3. **Run the App**  
   ```bash
   pnpm run dev
   ```

4. **Run Stress Test**  
   ```bash
   k6 run stress.js
   ```

---

## Verify

- Check for successful jobs in logs.
- There should be no error logs except for `E11000 duplicate key` errors.  
  These duplicates occur due to the small number of testing users and are expected.
- Confirm by checking the number of entries in the `passes` collection in MongoDB.

---

## TODO

Currently, an **HTTP 202 Accepted** response only means the booking request was **added to the queue**, not that it succeeded.

**Possible improvements:**
- Send a booking confirmation email after success.
- Implement client-side polling to check if booking succeeded.
- Add a job status API endpoint to query booking results.
