# Changelog

All notable changes to this project will be documented in this file.

## [0.9.1] - 2025-05-10
### Added
- Updated dependencies and refactored faker usage in services.

## [0.9.0] - 2025-05-10
### Changed
- Changed library import contract: now use suffix `/typeorm` or `/sequelize` for imports.

## [0.8.0] - 2025-04-21
### Added
- Refactored `typeorm-fake-entity` service to enhance method overrides and transaction handling.
- Enhanced transaction support with automatic error handling.
- Added detailed examples in README and transactions.md.
- Added transaction support for TypeORM with documentation and examples.
- Improved transaction rollback handling in integration tests.
- Added integration tests for Sequelize transactional operations.

### Fixed
- Fixed config issues in 0.7.x patch releases.
- Fixed excessive import issues and improved DB config.

## [0.7.0] - 2024-01-20
### Added
- Generalized logic with `fake-entity-core.service`.
- Major updates to TypeORM part with new features.
- Added entity pre- and post-processors.
- Introduced functional states.
- Added `withParent()` and `withNested()` helpers for advanced entity relationships.

### Improved
- Improved nested processing for Sequelize and TypeScript.
- Enhanced configuration execution and cleanup.
- Improved async execution logic.

### Fixed
- Fixed Sequelize relations to apply new nested processing for TypeScript.
- Fixed configuration execution and cleanup issues.
- Fixed postprocessing and added more tests.
- Improved test coverage and test cleanup.

### Documentation
- Updated README with new features and usage instructions.

## [0.6.0] - 2023-10-28
### Added
- Added addSequence and parent entities features.

## [0.5.0] - 2023-08-03
### Added
- Added Sequelize relations support for nested entities description.

## [0.4.0] - 2023-01-09
### Added
- Composite primary key support for Sequelize.
- Moved tests to a separate directory.
- Improved Readme documentation.

### Fixed
- Node engines fix.
- Added repository field in package.json.
- Test runner fixes.
- Run DB migrations in CI.

## [0.3.0] - 2023-01-05
### Added
- Added TypeORM support.
- CI and packaging fixes.

## [0.2.0] - 2023-01-04
### Added
- Jest integration tests config.
- Initial CI test setup.
- Basic README.

### Fixed
- GitHub action fixes.

## [0.1.0] - 2023-01-03
### Added
- Initial release.
