FROM node:22-bookworm-slim

# Install C++ build toolchain for the ADSA engine
RUN apt-get update && apt-get install -y --no-install-recommends \
    g++ \
    cmake \
    ninja-build \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy & compile C++ ADSA engine
COPY algorithms ./algorithms
COPY tests/algorithms ./tests/algorithms
RUN cmake -S algorithms -B algorithms/build -G Ninja -DCMAKE_CXX_COMPILER=g++ \
    && cmake --build algorithms/build \
    && ./algorithms/build/adsa_tests

# Install backend production dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# Copy application source
COPY backend ./backend
COPY frontend ./frontend
COPY database ./database

WORKDIR /app/backend
EXPOSE 5000

CMD ["node", "server.js"]
