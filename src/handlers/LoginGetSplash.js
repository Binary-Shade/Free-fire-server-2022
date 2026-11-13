/**
 * LoginGetSplash  (CSAnnouncementReq -> LoginSplashRes)  [public handshake]
 *
 * Ported from ported_6.js (handleLoginGetSplash). reference: login_get_splash @
 * htpp.py:2531 -> build_login_splash_protobuf @ htpp.py:2423. Returns a single
 * announcement, a single splash banner and a few activity-info entries.
 */

'use strict';

const { nowSecs } = require('./_shared');
const lobby = require('../../config/lobby-content');

function handleLoginGetSplash(reqObj, ctx) {
  const t = nowSecs();
  const banners = lobby.activeBanners(t);
  ctx.logger.info('[ported_6] LoginGetSplash');
  return {
    accouncement_res: {
      announcements: banners.map((banner, index) => ({
          language: lobby.language,
          order_in_this_language: index + 1,
          title: banner.title,
          image_url: banner.imageUrl,
          fb_page_id: '',
          image_url_for_lobby: banner.imageUrl,
          link_url: banner.linkUrl,
          desc: banner.description,
          start_time: banner.startAt || t - 86400 * 30,
          end_time: banner.endAt || t + 86400 * 365,
          region: lobby.region,
          id: banner.id,
          use_embedded_browser: true
        }))
    },
    splash_res: {
      splashBanners: banners.map((banner) => ({
          region: lobby.region,
          language: lobby.language,
          id: banner.id,
          name: banner.name,
          sort_id: banner.sortId,
          start_time: banner.startAt || t - 86400 * 30,
          end_time: banner.endAt || t + 86400 * 365,
          image_url: banner.imageUrl,
          gos_pos: 1,
          gos_url: banner.linkUrl,
          use_embedded_browser: true,
          sub_go_pos: '',
          video_url: '',
          bg_img_url: banner.imageUrl,
          type: 0,
          platform: 0,
          weight: 1,
          country_code: lobby.region,
          using_version: 0,
          active_phone_quality: 0,
          id_last_num: ''
        }))
    },
    activity_info_res: {
      activitys: [
        { id: 1, data: 100, state: 1 },
        { id: 2, data: 200, state: 2 },
        { id: 3, data: 300, state: 3 }
      ]
    }
  };
}

module.exports = {
  endpoint: 'LoginGetSplash',
  reqType: 'CSAnnouncementReq',
  resType: 'LoginSplashRes',
  handler: handleLoginGetSplash
};
