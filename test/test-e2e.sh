set -e

API_USER=${API_USER:-"guest"}
API_PASSWD=${API_PASSWD:-"guest"}
RABBIT_URL=${RABBIT_URL:-"localhost:15672"}

test_case=$(basename $1)
rp=$(realpath $1)

echo "Running ${test_case} in ${rp}"

echo Setting up
rabbit-toolbelt deploy "http://${API_USER}:${API_PASSWD}@${RABBIT_URL}" ${rp}/setup.def.json

echo Applying changes
rabbit-toolbelt deploy "http://${API_USER}:${API_PASSWD}@${RABBIT_URL}" ${rp}/test.def.json --recreate-changed

echo Result
rabbit-toolbelt diff "http://${API_USER}:${API_PASSWD}@${RABBIT_URL}" ${rp}/test.def.json --pretty

# --pretty omits empty properties
[[ $(rabbit-toolbelt diff "http://${API_USER}:${API_PASSWD}@${RABBIT_URL}" "${rp}/test.def.json" --pretty) == "{}" ]] || (echo "failed"; exit 1)

