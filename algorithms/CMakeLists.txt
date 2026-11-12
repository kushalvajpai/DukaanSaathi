cmake_minimum_required(VERSION 3.16)
project(DukaanSaathiADSA VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Core ADSA algorithm library
add_library(adsa_core STATIC
    binary_search.cpp
    merge_sort.cpp
    quick_sort.cpp
    inventory_fifo.cpp
    top_products.cpp
    profitability.cpp
)

target_include_directories(adsa_core PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})

# Main JSON CLI engine invoked by Node.js backend
add_executable(dukaansaathi_adsa
    main.cpp
)
target_link_libraries(dukaansaathi_adsa PRIVATE adsa_core)

# Standalone C++ unit test executable
add_executable(adsa_tests
    ../tests/algorithms/adsa_tests.cpp
)
target_link_libraries(adsa_tests PRIVATE adsa_core)
