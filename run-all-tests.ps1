# Run all tests once and exit
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Running Backend Tests" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

node --test backend/test/*.test.js

$backendExitCode = $LASTEXITCODE

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Running Frontend Tests" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

Set-Location frontend
npm run test -- --run --reporter=basic
$frontendExitCode = $LASTEXITCODE
Set-Location ..

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "TEST SUMMARY" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host "Backend Tests: $(if ($backendExitCode -eq 0) { 'PASSED' } else { 'FAILED' })" -ForegroundColor $(if ($backendExitCode -eq 0) { 'Green' } else { 'Red' })
Write-Host "Frontend Tests: $(if ($frontendExitCode -eq 0) { 'PASSED' } else { 'FAILED' })" -ForegroundColor $(if ($frontendExitCode -eq 0) { 'Green' } else { 'Red' })

if ($backendExitCode -eq 0 -and $frontendExitCode -eq 0) {
    Write-Host ""
    Write-Host "✓ ALL TESTS PASSED!" -ForegroundColor Green
    exit 0
} else {
    Write-Host ""
    Write-Host "✗ SOME TESTS FAILED" -ForegroundColor Red
    exit 1
}

