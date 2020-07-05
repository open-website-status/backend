import got from 'got';

export default async function verifyReCaptcha(captchaResponse: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET;
  if (secret === undefined) {
    throw new Error('Environment variable RECAPTCHA_SECRET not provided');
  }
  const response = await got.post<{
    success: boolean,
    challenge_ts: string,
    hostname: string,
    'error-codes': string[],
  }>('https://www.google.com/recaptcha/api/siteverify', {
    responseType: 'json',
    form: {
      secret,
      response: captchaResponse,
    },
  });

  return response.body.success;
}
