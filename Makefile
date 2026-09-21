.PHONY: dev test test-backend e2e build clean verify

dev:
	docker-compose up --build

test: test-backend

test-backend:
	cd backend && pytest tests -v --cov=app --cov-report=term-missing --cov-report=html

e2e:
	cd frontend && npm run test:e2e

verify:
	python -c "import hashlib, os; [(print('OK:', f)) for f, h in [line.strip().split('  ')[::-1] for line in open('samples/SHA256SUMS') if line.strip()] if hashlib.sha256(open(os.path.join('samples', f), 'rb').read()).hexdigest() == h]"

clean:
	rm -rf backend/.pytest_cache backend/htmlcov backend/.coverage backend/*.db frontend/.next
