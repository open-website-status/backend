import got from 'got';
import * as t from 'io-ts';
import * as tPromise from 'io-ts-promise';

export const IPApiResponseSuccess = t.type({
  status: t.literal('success'),
  countryCode: t.string,
  region: t.string,
  isp: t.string,
});

export const IPApiResponseFail = t.type({
  status: t.literal('fail'),
});

export const IPApiResponse = t.union([IPApiResponseFail, IPApiResponseSuccess]);

export interface IPInfo {
  countryCode: string,
  regionCode: string,
  ispName: string,
}

export async function getIPInfo(address: string): Promise<IPInfo> {
  const checkedAddress = address === '::ffff:127.0.0.1' ? '' : address;

  const response = await got.get(`http://ip-api.com/json/${checkedAddress}?fields=status,countryCode,region,isp`, {
    responseType: 'json',
  });

  const parsedResponse = await tPromise.decode(IPApiResponse, response.body);

  if (parsedResponse.status === 'fail') throw new Error('IP info check failed');

  return {
    countryCode: parsedResponse.countryCode.toLowerCase(),
    regionCode: parsedResponse.region.toLowerCase(),
    ispName: parsedResponse.isp,
  };
}
