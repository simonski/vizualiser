.PHONY: help build clean test run stop

help:
	@echo "viz - Year in Review Visualization"
	@echo ""
	@echo "Available targets:"
	@echo "  make build    - Download dependencies (already complete)"
	@echo "  make run      - Start Caddy server on port 8080"
	@echo "  make stop     - Stop Caddy server"
	@echo "  make clean    - Remove temporary files"
	@echo "  make test     - Run tests (placeholder)"
	@echo "  make help     - Show this help message"

build:
	@echo "Dependencies already downloaded to libs/"
	@echo "Build complete."

run:
	@echo "Starting Caddy server on http://localhost:8080"
	@caddy file-server --listen :8080 --browse

stop:
	@echo "Stopping Caddy server..."
	@pkill -f "caddy file-server" || echo "No Caddy process found"

clean:
	@echo "Cleaning up..."
	@rm -f *.log

test:
	@echo "Test suite not yet implemented"
	@echo "Manual testing: Run 'make run' and visit http://localhost:8080"
