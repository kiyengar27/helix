# Helix

Medplum staging workspace for Helix Family Health, using synthetic data.

- `code/src/`: application and workflow code
- `code/scripts/`: provisioning and verification scripts
- `.env`: local Medplum credentials; excluded from version control
- `code/.env`: symbolic link to the project credentials file
- `.env.example`: shareable configuration template

Fill in MEDPLUM_CLIENT_ID and MEDPLUM_CLIENT_SECRET in the root `.env` file locally. Never commit credentials.
