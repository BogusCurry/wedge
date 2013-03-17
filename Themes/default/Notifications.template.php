<?php
/**
 * Wedge
 *
 * Template for notifications
 *
 * @package wedge
 * @copyright 2010-2013 Wedgeward, wedge.org
 * @license http://wedge.org/license/
 *
 * @version 0.1
 */

function template_notifications_block()
{
	global $txt, $context, $settings, $scripturl;

	echo '
	<section>
		<header class="title notification_trigger">
			<span class="notification_count note', $context['unread_notifications'] ? 'nice' : '', '">
			', $context['unread_notifications'], '
			</span>
			', $txt['notifications'], '
		</header>
        <div id="notification_shade">
            <ul class="actions">
                <li>
                	<header class="title notification_trigger">
						<span class="notification_count note', $context['unread_notifications'] ? 'nice' : '', '" >
						', $context['unread_notifications'], '
						</span>
						', $txt['notifications'], '
                		<a href="<URL>?action=notification">(', $txt['view_all'], ')</a>
                	</header>
                	<div class="notification_container">
	                   	<div class="notification template">
	                    	<div class="notification_text">
	                    	</div>
	                    	<div>
	                    		<div class="notification_markread">x</div>
	                    		<div class="notification_time">
	                    		</div>
	                    		<br style="clear: both;" />
	                    	</div>
	                    	<hr />
	                    </div>
	                </div>
                </li>
            </ul>
        </div>
	</section>';
}

function template_notifications_list()
{
	global $txt, $context, $settings, $scripturl;

	echo '
		<we:title>', $txt['notifications'], '</we:title>';
	foreach ($context['notifications'] as $notification)
	{
		echo '
			<p class="', $notification->getUnread() ? 'description' : 'wrc windowbg', '  " style="font-size: 1em; cursor: pointer;"
				onclick="document.location = \'', $scripturl, '?action=notification;area=redirect;id=', $notification->getID(), '\'">
				', $notification->getText(), '<br />
				<span class="smalltext">', timeformat($notification->getTime()), '</span>
			</p>';
	}
}

function template_notification_email($notifications)
{
	global $txt;

	$text = $txt['notification_email_periodical_body'] . '<br /><br />';

	foreach ($notifications as $notifier => $notifs)
	{
		$profile = WeNotif::getNotifie($notifier)->getProfile();

		$text .= '
			<h3>' . $profile[0] . '</h3>
			<hr />
			<div style="margin-left: 15px;">';

		foreach ($notifs as $n)
			$text .= '<div>' . $n->getText() . '</div>';

		$text .='
			</div>';
	}

	return $text;
}