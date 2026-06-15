import seed from "@root/scripts/seed-mtgjson-prices";

export const handler = awslambda.streamifyResponse(async (_, responseStream) => {

  await seed(responseStream).catch((err: Error) => {
    console.error(err);
    process.exit(1);
  });

  responseStream.end()
  return 'Success'
})
