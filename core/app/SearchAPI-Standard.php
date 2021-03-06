<?php
/**
 * Provides information about the standard (unindexed) search method back to the Search framework.
 *
 * @package Wedge
 * @copyright 2010 René-Gilles Deberdt, wedge.org
 * @license http://wedge.org/license/
 * @author see contributors.txt
 */

if (!defined('WEDGE'))
	die('Hacking attempt...');

class standard_search
{
	// Standard search is supported by default.
	public $is_supported = true;

	// All APIs should support this function if nothing else. But all other detection is on method_exists...
	public function isValid()
	{
		return true;
	}

	public function getInfo()
	{
		global $txt;
		return array(
			'filename' => basename(__FILE__),
			'setting_index' => 'standard',
			'has_template' => true,
			'label' => $txt['search_index_none'],
			'desc' => '',
			'state' => 'none',
			'size' => 0,
			'can_create' => true,
		);
	}
}
